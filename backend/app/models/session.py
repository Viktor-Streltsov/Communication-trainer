import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # Nullable — anonymous sessions are allowed on MVP
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scenarios.id", ondelete="RESTRICT"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # "active" | "finished" | "abandoned"
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    # "soft" | "medium" | "hard" — controls persona aggressiveness modifier
    difficulty: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    # Hidden per-session character trait injected into the system prompt.
    # Never exposed during the dialogue; revealed as a post-session insight.
    random_trait: Mapped[str | None] = mapped_column(nullable=True)
