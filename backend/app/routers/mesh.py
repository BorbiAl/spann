"""Mesh relay registration and synchronization endpoints."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from redis.asyncio import Redis

from app.database import db
from app.schemas.common import success_response
from app.config import settings
from app.metrics import hash_identifier, mesh_sync_requests_total

router = APIRouter(prefix="/mesh", tags=["mesh"])

MESH_TIMESTAMP_WINDOW_SECONDS = 300
MESH_NONCE_TTL_SECONDS = 600


@dataclass(slots=True)
class MeshNodeContext:
    """Verified mesh node context returned by auth dependency."""

    node_id: str
    workspace_id: str


class MeshRegisterRequest(BaseModel):
    """Mesh node registration request payload."""

    model_config = ConfigDict(extra="forbid")

    node_name: str = Field(min_length=3, max_length=64)


class MeshRegisterResponse(BaseModel):
    """Mesh node registration response payload."""

    node_id: str
    node_secret: str


def _sha256_hex(value: str) -> str:
    """Return SHA-256 hex digest for identifier/secret handling."""

    return hashlib.sha256(value.encode("utf-8")).hexdigest()


async def _nonce_cache() -> Redis:
    """Build a small redis client for nonce replay tracking."""

    return Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        max_connections=20,
        socket_timeout=0.5,
        socket_connect_timeout=0.5,
    )


async def verify_mesh_node(request: Request, background_tasks: BackgroundTasks) -> MeshNodeContext:
    """Verify per-node signed mesh request with replay protection."""

    node_id = request.headers.get("X-Mesh-Node-ID", "").strip()
    timestamp_raw = request.headers.get("X-Mesh-Timestamp", "").strip()
    nonce = request.headers.get("X-Mesh-Nonce", "").strip()
    signature = request.headers.get("X-Mesh-Signature", "").strip()

    if not node_id or not timestamp_raw or not nonce or not signature:
        raise HTTPException(status_code=401, detail={"code": "mesh_auth_missing", "message": "Missing mesh auth headers."})

    node = await db.get_mesh_node(node_id)
    if node is None or bool(node.get("revoked")):
        raise HTTPException(status_code=401, detail={"code": "mesh_node_invalid", "message": "Mesh node is invalid or revoked."})

    try:
        ts = int(timestamp_raw)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail={"code": "mesh_timestamp_invalid", "message": "Timestamp must be unix seconds."}) from exc

    now = int(time.time())
    if abs(now - ts) > MESH_TIMESTAMP_WINDOW_SECONDS:
        raise HTTPException(status_code=401, detail={"code": "mesh_timestamp_out_of_window", "message": "Timestamp outside allowed window."})

    body_bytes = await request.body()
    body_hash = hashlib.sha256(body_bytes).hexdigest()
    signing_input = f"{node_id}:{timestamp_raw}:{nonce}:{body_hash}"

    # Node secret is delivered once at registration and stored as hashed signing key.
    server_secret = str(node.get("secret_hash", ""))
    expected = hmac.new(server_secret.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail={"code": "mesh_signature_invalid", "message": "Mesh request signature is invalid."})

    nonce_key = f"nonce:{nonce}"
    cache = await _nonce_cache()
    try:
        existing = await cache.get(nonce_key)
        if existing is not None:
            raise HTTPException(status_code=401, detail={"code": "mesh_replay_detected", "message": "Nonce replay detected."})

        await cache.set(nonce_key, "1", ex=MESH_NONCE_TTL_SECONDS)
    finally:
        await cache.aclose()

    background_tasks.add_task(db.update_mesh_node_last_seen, node_id)
    return MeshNodeContext(node_id=node_id, workspace_id=str(node["workspace_id"]))


class MeshSyncRequest(BaseModel):
    """Batch payload for mesh relay delivery synchronization."""

    model_config = ConfigDict(extra="forbid")

    messages: list[dict] = Field(default_factory=list, max_length=200)


@router.post("/register")
async def register_mesh_node(payload: MeshRegisterRequest, request: Request):
    """Register a mesh node for the authenticated user's workspace."""

    claims = getattr(request.state, "auth", {})
    user_id = str(getattr(request.state, "user_id", ""))
    workspace_id = str(claims.get("workspace_id", "")).strip()
    if not workspace_id:
        raise HTTPException(status_code=403, detail={"code": "workspace_claim_missing", "message": "workspace_id claim is required."})

    await db.verify_workspace_access(user_id=UUID(user_id), workspace_id=UUID(workspace_id), required_role="member")

    node_id = f"node-{secrets.token_hex(8)}-{payload.node_name.lower().replace(' ', '-')[:24]}"
    raw_secret = secrets.token_hex(32)
    secret_hash = _sha256_hex(raw_secret)

    # Return the signing key once; persist only its hash as required.
    await db.create_mesh_node(workspace_id=workspace_id, node_id=node_id, secret_hash=secret_hash)
    return success_response({"node_id": node_id, "node_secret": secret_hash}, status_code=201)


@router.post("/sync")
async def sync_mesh_messages(
    payload: MeshSyncRequest,
    _mesh_ctx: MeshNodeContext = Depends(verify_mesh_node),
):
    """Persist delivered mesh messages for backend reconciliation."""

    mesh_sync_requests_total.labels(node_id=hash_identifier(_mesh_ctx.node_id)).inc()
    synced = await db.sync_mesh_messages(payload.messages)
    return success_response({"synced": synced}, status_code=201)
