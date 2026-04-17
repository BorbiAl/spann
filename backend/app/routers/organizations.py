"""Organization onboarding, invitations, and join-request routes."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from app.database import db
from app.middleware.rate_limit import public_rate_limit_dependency
from app.schemas.common import success_response
from app.schemas.organization import (
    InvitationDecisionRequest,
    JoinRequestDecisionRequest,
    OrganizationCreateRequest,
    OrganizationInviteRequest,
    OrganizationJoinRequestCreate,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/onboarding")
async def get_onboarding_state(
    request: Request,
    search: str | None = Query(default=None, max_length=120),
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """Return data needed by the post-login organization onboarding screen."""

    user_id = str(request.state.user_id)
    my_org_rows = await db.list_user_organizations(user_id=user_id)
    discoverable_orgs = await db.list_discoverable_organizations(user_id=user_id, search=search)
    invitations = await db.list_pending_invitations_for_user(user_id=user_id)

    my_orgs: list[dict[str, str | None]] = []
    workspace_name_map: dict[str, str | None] = {}
    pending_join_requests: list[dict[str, str | None]] = []

    for row in my_org_rows:
        workspace = row.get("workspace") if isinstance(row, dict) else {}
        workspace_id = str(row.get("workspace_id", ""))
        role = str(row.get("role", "member")).lower()
        organization = {
            "workspace_id": workspace_id,
            "name": workspace.get("name") if isinstance(workspace, dict) else None,
            "slug": workspace.get("slug") if isinstance(workspace, dict) else None,
            "role": role,
            "joined_at": row.get("joined_at"),
        }
        my_orgs.append(organization)
        workspace_name_map[workspace_id] = organization["name"]

        if role in {"owner", "admin"}:
            pending_rows = await db.list_workspace_join_requests(workspace_id=workspace_id)
            for pending in pending_rows:
                pending_join_requests.append(
                    {
                        "id": str(pending.get("id", "")),
                        "workspace_id": workspace_id,
                        "workspace_name": organization["name"],
                        "requester_user_id": str(pending.get("requester_user_id", "")),
                        "requester_email": pending.get("requester_email"),
                        "requester_display_name": pending.get("requester_display_name"),
                        "message": pending.get("message"),
                        "status": str(pending.get("status", "pending")),
                        "created_at": pending.get("created_at"),
                    }
                )

    pending_join_requests.sort(key=lambda item: str(item.get("created_at", "")), reverse=True)

    return success_response(
        {
            "my_organizations": my_orgs,
            "discoverable_organizations": discoverable_orgs,
            "pending_invitations": invitations,
            "pending_join_requests": pending_join_requests,
            "current_workspace_id": str((request.state.auth or {}).get("workspace_id", "") or ""),
        }
    )


@router.post("")
async def create_organization(
    payload: OrganizationCreateRequest,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """Create a new organization owned by the authenticated user."""

    user_id = str(request.state.user_id)
    workspace = await db.create_organization(owner_user_id=user_id, name=payload.name)
    return success_response({"organization": workspace}, status_code=201)


@router.post("/{workspace_id}/invites")
async def invite_user(
    workspace_id: UUID,
    payload: OrganizationInviteRequest,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """Invite an email to join the selected organization."""

    user_id = UUID(str(request.state.user_id))
    await db.verify_workspace_access(user_id=user_id, workspace_id=workspace_id, required_role="owner")

    invitation = await db.invite_user_by_email(
        workspace_id=str(workspace_id),
        invited_by_user_id=str(user_id),
        email=payload.email,
        note=payload.note,
    )
    return success_response(invitation, status_code=201)


@router.get("/{workspace_id}/members")
async def list_workspace_members(
    workspace_id: UUID,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """List members for a workspace, including lightweight online status."""

    user_id = UUID(str(request.state.user_id))
    await db.verify_workspace_access(user_id=user_id, workspace_id=workspace_id, required_role="member")
    members = await db.list_workspace_members(workspace_id=str(workspace_id))
    return success_response(members)


@router.delete("/{workspace_id}/members/{member_user_id}")
async def remove_workspace_member(
    workspace_id: UUID,
    member_user_id: UUID,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """Remove a member from a workspace (owner only)."""

    owner_id = str(request.state.user_id)
    await db.verify_workspace_access(user_id=UUID(owner_id), workspace_id=workspace_id, required_role="owner")

    if owner_id == str(member_user_id):
        raise HTTPException(
            status_code=409,
            detail={"code": "owner_self_remove_forbidden", "message": "Workspace owners cannot remove themselves."},
        )

    members = await db.list_workspace_members(workspace_id=str(workspace_id))
    target_member = next((member for member in members if str(member.get("user_id", "")) == str(member_user_id)), None)
    if target_member is None:
        raise HTTPException(status_code=404, detail={"code": "member_not_found", "message": "Member not found in workspace."})

    if str(target_member.get("role", "member")).lower() == "owner":
        raise HTTPException(
            status_code=409,
            detail={"code": "owner_remove_forbidden", "message": "Owner members cannot be removed from this endpoint."},
        )

    result = await db.remove_workspace_member(workspace_id=str(workspace_id), member_user_id=str(member_user_id))
    return success_response(result)


@router.post("/join-requests")
async def create_join_request(
    payload: OrganizationJoinRequestCreate,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """Submit a join request for an organization."""

    user_id = str(request.state.user_id)
    join_request = await db.create_join_request(
        workspace_id=str(payload.workspace_id),
        requester_user_id=user_id,
        message=payload.message,
    )
    return success_response(join_request, status_code=201)


@router.get("/{workspace_id}/join-requests")
async def list_join_requests(
    workspace_id: UUID,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """List pending join requests for an owner/admin-managed organization."""

    user_id = UUID(str(request.state.user_id))
    await db.verify_workspace_access(user_id=user_id, workspace_id=workspace_id, required_role="owner")
    requests = await db.list_workspace_join_requests(workspace_id=str(workspace_id))
    return success_response(requests)


@router.post("/join-requests/{join_request_id}/decision")
async def decide_join_request(
    join_request_id: UUID,
    payload: JoinRequestDecisionRequest,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """Approve or reject an organization join request."""

    user_id = str(request.state.user_id)
    result = await db.decide_join_request(
        join_request_id=str(join_request_id),
        reviewer_user_id=user_id,
        decision=payload.decision,
    )
    return success_response(result)


@router.post("/invitations/{invitation_id}/decision")
async def decide_invitation(
    invitation_id: UUID,
    payload: InvitationDecisionRequest,
    request: Request,
    _rate_limit: None = Depends(public_rate_limit_dependency),
) -> JSONResponse:
    """Accept or reject an invitation that belongs to the current user."""

    user_id = str(request.state.user_id)
    result = await db.decide_invitation(
        invitation_id=str(invitation_id),
        user_id=user_id,
        decision=payload.decision,
    )
    return success_response(result)
