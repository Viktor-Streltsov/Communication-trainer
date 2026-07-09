"""add difficulty to sessions and short_description to scenarios

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-10
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column(
            "difficulty",
            sa.String(16),
            nullable=False,
            server_default="medium",
        ),
    )
    op.add_column(
        "scenarios",
        sa.Column(
            "short_description",
            sa.Text,
            nullable=False,
            server_default="",
        ),
    )


def downgrade() -> None:
    op.drop_column("scenarios", "short_description")
    op.drop_column("sessions", "difficulty")
