"""Carbon logging and leaderboard routes."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID

from app.database import db
from app.middleware.rate_limit import public_rate_limit_dependency
from app.schemas.common import error_response, success_response
from app.metrics import carbon_logs_total
from app.tasks.carbon import recalculate_carbon_leaderboard

router = APIRouter(prefix="/carbon", tags=["carbon"])


class CarbonLogRequest(BaseModel):
    """Payload for recording one carbon log item."""

    model_config = ConfigDict(extra="forbid")

    workspace_id: UUID
    transport_type: str = Field(min_length=3, max_length=16)
    kg_co2: float = Field(ge=0.0, le=500.0)


@router.get("/leaderboard")
async def get_leaderboard(
    workspace_id: UUID,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
):
    """Return carbon leaderboard sorted by score descending."""

    user_id = UUID(str(request.state.user_id))
    await db.verify_workspace_access(user_id=user_id, workspace_id=workspace_id, required_role="member")

    leaderboard = await db.get_carbon_leaderboard(str(workspace_id))
    return success_response(leaderboard)


@router.post("/log")
async def create_carbon_log(
    payload: CarbonLogRequest,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
):
    """Log a user commute and asynchronously refresh aggregates."""

    user_id = str(request.state.user_id)
    await db.verify_workspace_access(
        user_id=UUID(user_id),
        workspace_id=payload.workspace_id,
        required_role="member",
    )

    transport_type = payload.transport_type.lower().strip()
    if transport_type not in {"car", "bus", "bike", "remote", "train", "walk", "flight"}:
        return error_response(
            status_code=422,
            code="invalid_transport_type",
            message="transport_type must be one of car,bus,bike,remote,train,walk,flight.",
        )

    daily_count = await db.count_daily_carbon_logs(
        user_id=user_id,
        workspace_id=str(payload.workspace_id),
        day=datetime.now(UTC),
    )
    if daily_count >= 5:
        return error_response(
            status_code=429,
            code="daily_log_limit_exceeded",
            message="Daily carbon log limit exceeded.",
        )

    logged = await db.create_carbon_log(
        user_id=user_id,
        workspace_id=str(payload.workspace_id),
        transport_type=transport_type,
        kg_co2=payload.kg_co2,
    )
    carbon_logs_total.labels(transport_type=transport_type).inc()
    recalculate_carbon_leaderboard.delay(str(payload.workspace_id))
    return success_response(logged, status_code=201)
