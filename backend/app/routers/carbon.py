"""Carbon logging and leaderboard routes."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.database import db
from app.schemas.carbon import CarbonLogRequest
from app.schemas.common import error_response, success_response
from app.tasks.carbon import recalculate_carbon_leaderboard

router = APIRouter(prefix="/carbon", tags=["carbon"])


@router.get("/leaderboard")
async def get_leaderboard(workspace_id: str):
    """Return carbon leaderboard sorted by score descending."""

    if not workspace_id.strip():
        return error_response(status_code=400, code="BAD_REQUEST", message="workspace_id is required.")

    leaderboard = await db.get_carbon_leaderboard(workspace_id)
    return success_response(leaderboard)


@router.post("/log")
async def create_carbon_log(payload: CarbonLogRequest, request: Request):
    """Log a user commute and asynchronously refresh aggregates."""

    user_id = request.state.user_id
    logged = await db.create_carbon_log(
        user_id=user_id,
        workspace_id=payload.workspace_id,
        commute_mode=payload.commute_mode,
        distance_km=payload.distance_km,
    )
    recalculate_carbon_leaderboard.delay(payload.workspace_id)
    return success_response(logged, status_code=201)
