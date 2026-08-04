"""initial requisition schema

Revision ID: 0001
Revises:
Create Date: 2026-08-04
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_profiles",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=36), nullable=False, server_default="local"),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("industry", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("size", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("location", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("tech_stack", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_company_profiles_tenant_id", "company_profiles", ["tenant_id"])

    op.create_table(
        "requisitions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=36), nullable=False, server_default="local"),
        sa.Column(
            "company_profile_id",
            sa.String(length=36),
            sa.ForeignKey("company_profiles.id"),
            nullable=True,
        ),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="Draft"),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("intent", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("intake_answers", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("structured_role", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("generated_jd_markdown", sa.Text(), nullable=True),
        sa.Column("coverage_result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("approved_by", sa.String(length=36), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_requisitions_tenant_id", "requisitions", ["tenant_id"])
    op.create_index("ix_requisitions_company_profile_id", "requisitions", ["company_profile_id"])

    op.create_table(
        "decision_records",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "requisition_id",
            sa.String(length=36),
            sa.ForeignKey("requisitions.id"),
            nullable=False,
        ),
        sa.Column("agent_name", sa.String(length=100), nullable=False),
        sa.Column("input_context", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("output", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("guardrail_status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("reviewed_by", sa.String(length=36), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision", sa.String(length=20), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_decision_records_requisition_id", "decision_records", ["requisition_id"])


def downgrade() -> None:
    op.drop_table("decision_records")
    op.drop_table("requisitions")
    op.drop_table("company_profiles")