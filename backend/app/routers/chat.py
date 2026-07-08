import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.message import Message
from app.models.scenario import Scenario
from app.models.session import Session as ChatSession
from app.services.llm_client import llm_client

router = APIRouter(prefix="/chat", tags=["chat"])


# ------------------------------------------------------------------
# Request / Response schemas
# ------------------------------------------------------------------

class StartRequest(BaseModel):
    scenario_id: str  # scenario code, e.g. "interview_strict"


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

    session = ChatSession(scenario_id=scenario.id)
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

    # Build LLM context: system prompt + conversation turns
    llm_history = [{"role": "system", "content": scenario.system_prompt}]
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


@router.get("/scenarios")
async def list_scenarios(db: AsyncSession = Depends(get_db)) -> list[dict]:
    """Return all available scenarios from the database."""
    result = await db.execute(select(Scenario).order_by(Scenario.title))
    scenarios = result.scalars().all()
    return [
        {"scenario_id": s.code, "display_name": s.title, "strictness": s.strictness}
        for s in scenarios
    ]
