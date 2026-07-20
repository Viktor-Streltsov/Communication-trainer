"""Scenario management endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.scenario import Scenario
from app.models.user import User
from app.services.auth_dependency import get_current_user_optional
from app.services.scenario_generator import ScenarioGeneratorError, generate_scenario

router = APIRouter(prefix="/scenarios", tags=["scenarios"])

_MIN_DESCRIPTION_LEN = 15


# ------------------------------------------------------------------
# Schemas
# ------------------------------------------------------------------


class CustomScenarioRequest(BaseModel):
    description: str

    @field_validator("description")
    @classmethod
    def description_not_too_short(cls, v: str) -> str:
        if len(v.strip()) < _MIN_DESCRIPTION_LEN:
            raise ValueError(
                f"Описание слишком короткое — напиши хотя бы {_MIN_DESCRIPTION_LEN} символов, "
                "чтобы персонаж получился живым."
            )
        return v.strip()


class CustomScenarioResponse(BaseModel):
    scenario_id: str
    display_name: str
    short_description: str


# ------------------------------------------------------------------
# Endpoint
# ------------------------------------------------------------------


@router.post("/custom", response_model=CustomScenarioResponse, status_code=201)
async def create_custom_scenario(
    body: CustomScenarioRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> CustomScenarioResponse:
    """Generate and persist a custom scenario from a free-text description.

    Requires a valid JWT. Returns the new scenario's identifiers so the client
    can immediately start a session with it.
    """
    if current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required.")

    try:
        generated = await generate_scenario(body.description)
    except ScenarioGeneratorError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Не удалось сгенерировать сценарий: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Ошибка при обращении к языковой модели. Попробуй ещё раз.",
        ) from exc

    # Custom scenarios get a unique code prefixed with the user id shard
    code = f"custom_{uuid.uuid4().hex[:12]}"

    scenario = Scenario(
        code=code,
        title=generated["display_name"],
        role_type=generated["role_type"],
        # Custom scenarios have no fixed strictness level — the difficulty
        # modifier at session start handles aggressiveness.
        strictness="medium",
        system_prompt=generated["system_prompt"],
        opening_line=generated["opening_line"],
        short_description=generated["short_description"],
        owner_user_id=current_user.id,
    )
    db.add(scenario)
    await db.commit()

    return CustomScenarioResponse(
        scenario_id=code,
        display_name=generated["display_name"],
        short_description=generated["short_description"],
    )
