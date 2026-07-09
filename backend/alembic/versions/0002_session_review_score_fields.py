"""add score and impression fields to session_reviews

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-10
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.add_column(
        "session_reviews",
        sa.Column("success_score", sa.Integer, nullable=False, server_default="0"),
    )
    op.add_column(
        "session_reviews",
        sa.Column("overall_impression", sa.Text, nullable=False, server_default=""),
    )
    op.add_column(
        "session_reviews",
        sa.Column("motivational_message", sa.Text, nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("session_reviews", "motivational_message")
    op.drop_column("session_reviews", "overall_impression")
    op.drop_column("session_reviews", "success_score")
