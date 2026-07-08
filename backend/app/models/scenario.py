import uuid

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # Short machine-readable identifier, e.g. "interview_strict"
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # High-level category: "hr" | "manager" | "parent" | …
    role_type: Mapped[str] = mapped_column(String(64), nullable=False)
    # Persona aggressiveness: "low" | "medium" | "high"
    strictness: Mapped[str] = mapped_column(String(32), nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    opening_line: Mapped[str] = mapped_column(Text, nullable=False)
