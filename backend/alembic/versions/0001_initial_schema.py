"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-09
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    # ── users ──────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    # ── scenarios ──────────────────────────────────────────────────────────
    op.create_table(
        "scenarios",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("role_type", sa.String(64), nullable=False),
        sa.Column("strictness", sa.String(32), nullable=False),
        sa.Column("system_prompt", sa.Text, nullable=False),
        sa.Column("opening_line", sa.Text, nullable=False),
        sa.UniqueConstraint("code", name="uq_scenarios_code"),
    )
    op.create_index("ix_scenarios_code", "scenarios", ["code"])

    # ── sessions ───────────────────────────────────────────────────────────
    op.create_table(
        "sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("scenario_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_sessions_user_id", ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["scenario_id"],
            ["scenarios.id"],
            name="fk_sessions_scenario_id",
            ondelete="RESTRICT",
        ),
    )

    # ── messages ───────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False),
        sa.Column("sender", sa.String(8), nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.id"],
            name="fk_messages_session_id",
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_messages_session_id", "messages", ["session_id"])

    # ── session_reviews ────────────────────────────────────────────────────
    op.create_table(
        "session_reviews",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False),
        sa.Column("summary_text", sa.Text, nullable=False),
        sa.Column("strengths", JSONB, nullable=False, server_default="[]"),
        sa.Column("weak_points", JSONB, nullable=False, server_default="[]"),
        sa.Column("suggested_phrasings", JSONB, nullable=False, server_default="[]"),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.id"],
            name="fk_session_reviews_session_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("session_id", name="uq_session_reviews_session_id"),
    )


def downgrade() -> None:
    op.drop_table("session_reviews")
    op.drop_index("ix_messages_session_id", table_name="messages")
    op.drop_table("messages")
    op.drop_table("sessions")
    op.drop_index("ix_scenarios_code", table_name="scenarios")
    op.drop_table("scenarios")
    op.drop_table("users")
