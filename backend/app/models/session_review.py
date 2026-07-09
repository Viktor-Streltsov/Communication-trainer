import uuid

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SessionReview(Base):
    __tablename__ = "session_reviews"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)

    # Score + rich text fields (added in migration 0002)
    success_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overall_impression: Mapped[str] = mapped_column(Text, nullable=False, default="")
    motivational_message: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Structured feedback stored as JSONB
    strengths: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    weak_points: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    suggested_phrasings: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
