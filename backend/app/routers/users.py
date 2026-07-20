"""User-facing endpoints (requires authentication)."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.scenario import Scenario
from app.models.session import Session as ChatSession
from app.models.session_review import SessionReview
from app.models.user import User
from app.services.auth_dependency import get_current_user_optional

router = APIRouter(prefix="/users", tags=["users"])


# ------------------------------------------------------------------
# Schemas
# ------------------------------------------------------------------


class SessionEntry(BaseModel):
    date: datetime
    success_score: int


class ScenarioProgress(BaseModel):
    scenario_id: str
    display_name: str
    sessions: list[SessionEntry]


# ------------------------------------------------------------------
# Endpoint
# ------------------------------------------------------------------


@router.get("/me/progress", response_model=list[ScenarioProgress])
async def get_my_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> list[ScenarioProgress]:
    """Return per-scenario progress for the authenticated user.

    Each item contains the scenario identity and a chronological list of
    finished sessions with their date and success_score.
    Returns an empty list when the user has no finished sessions.
    """
    if current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required.")

    rows = await db.execute(
        select(
            Scenario.code,
            Scenario.title,
            ChatSession.started_at,
            SessionReview.success_score,
        )
        .join(SessionReview, SessionReview.session_id == ChatSession.id)
        .join(Scenario, Scenario.id == ChatSession.scenario_id)
        .where(
            ChatSession.user_id == current_user.id,
            ChatSession.status == "finished",
        )
        .order_by(Scenario.code, ChatSession.started_at)
    )

    # Group by scenario preserving insertion (alphabetical-by-code) order
    groups: dict[str, ScenarioProgress] = defaultdict(
        lambda: ScenarioProgress(scenario_id="", display_name="", sessions=[])
    )
    for code, title, started_at, success_score in rows:
        if code not in groups:
            groups[code] = ScenarioProgress(
                scenario_id=code,
                display_name=title,
                sessions=[],
            )
        groups[code].sessions.append(
            SessionEntry(date=started_at, success_score=success_score)
        )

    return list(groups.values())
