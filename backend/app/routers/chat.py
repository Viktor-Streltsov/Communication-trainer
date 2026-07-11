import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.message import Message
from app.models.scenario import Scenario
from app.models.session import Session as ChatSession
from app.models.session_review import SessionReview
from app.services.analysis import analyse_session
from app.services.llm_client import llm_client
from app.services.persona_prompts import DIFFICULTY_MODIFIERS
from app.services.random_traits import pick_trait, revealed_hint

router = APIRouter(prefix="/chat", tags=["chat"])


# ------------------------------------------------------------------
# Request / Response schemas
# ------------------------------------------------------------------

class StartRequest(BaseModel):
    scenario_id: str   # scenario code, e.g. "interview_strict"
    difficulty: str = "medium"  # "soft" | "medium" | "hard"


class StartResponse(BaseModel):
    session_id: str
    scenario_id: str   # code
    display_name: str
    message: str       # persona's opening line


class MessageRequest(BaseModel):
    session_id: str
    text: str


class MessageResponse(BaseModel):
    session_id: str
    message: str       # persona's reply


class EndRequest(BaseModel):
    session_id: str


class WeakPoint(BaseModel):
    phrase: str = ""
    problem: str = ""


class SuggestedPhrasing(BaseModel):
    original: str = ""
    improved: str = ""


class ReviewResponse(BaseModel):
    session_id: str
    summary_text: str
    success_score: int
    overall_impression: str
    strengths: list
    weak_points: list
    suggested_phrasings: list
    motivational_message: str
    # Post-session character insight; None for legacy sessions without a trait.
    revealed_trait: str | None = None


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@router.post("/start", response_model=StartResponse)
async def start_session(
    body: StartRequest,
    db: AsyncSession = Depends(get_db),
) -> StartResponse:
    """
    Create a new dialogue session for the given scenario.
    Saves the session and opening AI message to the database.
    """
    result = await db.execute(select(Scenario).where(Scenario.code == body.scenario_id))
    scenario = result.scalar_one_or_none()
    if scenario is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario_id '{body.scenario_id}'. "
                   "Check GET /chat/scenarios for available options.",
        )

    difficulty = body.difficulty if body.difficulty in ("soft", "medium", "hard") else "medium"
    trait = pick_trait(scenario.role_type)
    session = ChatSession(scenario_id=scenario.id, difficulty=difficulty, random_trait=trait or None)
    db.add(session)
    await db.flush()  # get session.id before adding messages

    opening_msg = Message(
        session_id=session.id,
        sender="ai",
        text=scenario.opening_line,
    )
    db.add(opening_msg)
    await db.commit()

    return StartResponse(
        session_id=str(session.id),
        scenario_id=scenario.code,
        display_name=scenario.title,
        message=scenario.opening_line,
    )


@router.post("/message", response_model=MessageResponse)
async def send_message(
    body: MessageRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Send a user message; get the persona's reply.
    Full conversation history is rebuilt from the database on each call.
    """
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="Message text cannot be empty.")

    try:
        session_uuid = uuid.UUID(body.session_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="session_id must be a valid UUID.")

    # Load session
    session_result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_uuid)
    )
    session = session_result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found. Call /chat/start first.")
    if session.status != "active":
        raise HTTPException(status_code=400, detail=f"Session is '{session.status}', not active.")

    # Load scenario (system prompt)
    scenario_result = await db.execute(
        select(Scenario).where(Scenario.id == session.scenario_id)
    )
    scenario = scenario_result.scalar_one()

    # Load full message history ordered by creation time
    msgs_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_uuid)
        .order_by(Message.created_at)
    )
    db_messages = msgs_result.scalars().all()

    # Build LLM context: system prompt + difficulty modifier + random trait + turns
    difficulty_modifier = DIFFICULTY_MODIFIERS.get(session.difficulty, "")
    trait_modifier = session.random_trait or ""
    effective_prompt = scenario.system_prompt + difficulty_modifier + trait_modifier
    llm_history = [{"role": "system", "content": effective_prompt}]
    for msg in db_messages:
        role = "user" if msg.sender == "user" else "assistant"
        llm_history.append({"role": role, "content": msg.text})
    llm_history.append({"role": "user", "content": body.text})

    # Call LLM
    try:
        reply = await llm_client.chat(llm_history)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {exc}") from exc

    # Persist both messages atomically
    db.add(Message(session_id=session_uuid, sender="user", text=body.text))
    db.add(Message(session_id=session_uuid, sender="ai", text=reply))
    await db.commit()

    return MessageResponse(session_id=body.session_id, message=reply)


@router.post("/end", response_model=ReviewResponse)
async def end_session(
    body: EndRequest,
    db: AsyncSession = Depends(get_db),
) -> ReviewResponse:
    """
    Mark the session as finished, run the AI coach analysis, persist the
    SessionReview, and return the structured feedback.
    """
    try:
        session_uuid = uuid.UUID(body.session_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="session_id must be a valid UUID.")

    # Load session
    session_result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_uuid)
    )
    session = session_result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.status != "active":
        raise HTTPException(
            status_code=400,
            detail=f"Session is already '{session.status}'. Cannot end it again.",
        )

    # Check whether a review was already saved (e.g. concurrent request)
    existing_review = await db.execute(
        select(SessionReview).where(SessionReview.session_id == session_uuid)
    )
    if existing_review.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409, detail="A review for this session already exists."
        )

    # Mark session finished
    session.status = "finished"
    session.ended_at = datetime.now(timezone.utc)
    await db.flush()

    # Load full message history
    msgs_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_uuid)
        .order_by(Message.created_at)
    )
    messages = msgs_result.scalars().all()

    # Run AI coach analysis
    try:
        result = await analyse_session(list(messages))
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=502, detail=f"Coach analysis failed: {exc}") from exc

    # Build post-session character insight from the hidden random trait
    hint = revealed_hint(session.random_trait or "")

    # Persist review
    review = SessionReview(
        session_id=session_uuid,
        summary_text=result.summary_text,
        success_score=result.success_score,
        overall_impression=result.overall_impression,
        strengths=result.strengths,
        weak_points=result.weak_points,
        suggested_phrasings=result.suggested_phrasings,
        motivational_message=result.motivational_message,
        revealed_trait=hint or None,
    )
    db.add(review)
    await db.commit()

    return ReviewResponse(
        session_id=body.session_id,
        summary_text=result.summary_text,
        success_score=result.success_score,
        overall_impression=result.overall_impression,
        strengths=result.strengths,
        weak_points=result.weak_points,
        suggested_phrasings=result.suggested_phrasings,
        motivational_message=result.motivational_message,
        revealed_trait=hint or None,
    )


@router.get("/session/{session_id}/review", response_model=ReviewResponse)
async def get_review(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> ReviewResponse:
    """Return the saved coach review for a finished session."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="session_id must be a valid UUID.")

    review_result = await db.execute(
        select(SessionReview).where(SessionReview.session_id == session_uuid)
    )
    review = review_result.scalar_one_or_none()
    if review is None:
        raise HTTPException(
            status_code=404,
            detail="Review not found. The session may not be finished yet.",
        )

    return ReviewResponse(
        session_id=session_id,
        summary_text=review.summary_text,
        success_score=review.success_score,
        overall_impression=review.overall_impression,
        strengths=review.strengths,
        weak_points=review.weak_points,
        suggested_phrasings=review.suggested_phrasings,
        motivational_message=review.motivational_message,
        revealed_trait=review.revealed_trait,
    )


@router.get("/scenarios")
async def list_scenarios(db: AsyncSession = Depends(get_db)) -> list[dict]:
    """Return all available scenarios from the database."""
    result = await db.execute(select(Scenario).order_by(Scenario.title))
    scenarios = result.scalars().all()
    return [
        {
            "scenario_id": s.code,
            "display_name": s.title,
            "strictness": s.strictness,
            "short_description": s.short_description,
        }
        for s in scenarios
    ]
