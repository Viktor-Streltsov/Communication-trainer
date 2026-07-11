"""add random_trait to sessions and revealed_trait to session_reviews

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-11
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("random_trait", sa.Text, nullable=True),
    )
    op.add_column(
        "session_reviews",
        sa.Column("revealed_trait", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("session_reviews", "revealed_trait")
    op.drop_column("sessions", "random_trait")
