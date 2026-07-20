"""add owner_user_id to scenarios

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-21
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.add_column(
        "scenarios",
        sa.Column("owner_user_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_scenarios_owner_user_id",
        "scenarios",
        "users",
        ["owner_user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_scenarios_owner_user_id", "scenarios", ["owner_user_id"])


def downgrade() -> None:
    op.drop_index("ix_scenarios_owner_user_id", table_name="scenarios")
    op.drop_constraint("fk_scenarios_owner_user_id", "scenarios", type_="foreignkey")
    op.drop_column("scenarios", "owner_user_id")
