"""add pending_question to requisitions

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-05
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("requisitions", sa.Column("pending_question", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("requisitions", "pending_question")
