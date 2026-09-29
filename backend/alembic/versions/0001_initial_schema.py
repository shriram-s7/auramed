"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-09-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

user_role = postgresql.ENUM("admin", "doctor", "patient", name="user_role", create_type=False)
screening_module = postgresql.ENUM(
    "breast", "cervical", "pcos", name="screening_module", create_type=False
)
scan_status = postgresql.ENUM("draft", "analyzed", "reported", name="scan_status", create_type=False)
risk_level = postgresql.ENUM(
    "low", "moderate", "high", "critical", name="risk_level", create_type=False
)
report_status = postgresql.ENUM("draft", "signed", "addendum", name="report_status", create_type=False)
appointment_status = postgresql.ENUM(
    "scheduled",
    "completed",
    "cancelled",
    "rescheduled",
    name="appointment_status",
    create_type=False,
)
referral_priority = postgresql.ENUM(
    "routine", "urgent", "emergency", name="referral_priority", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    user_role.create(bind, checkfirst=True)
    screening_module.create(bind, checkfirst=True)
    scan_status.create(bind, checkfirst=True)
    risk_level.create(bind, checkfirst=True)
    report_status.create(bind, checkfirst=True)
    appointment_status.create(bind, checkfirst=True)
    referral_priority.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "doctor_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("registration_number", sa.String(100), nullable=False, unique=True),
        sa.Column("specialty", sa.String(255), nullable=True),
        sa.Column("hospital", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("is_approved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "patient_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(20), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("pin_code", sa.String(20), nullable=True),
        sa.Column("blood_group", sa.String(10), nullable=True),
        sa.Column("emergency_contact_name", sa.String(255), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(20), nullable=True),
        sa.Column("emergency_contact_relation", sa.String(100), nullable=True),
        sa.Column("family_history", postgresql.JSON(), nullable=True),
        sa.Column("personal_medical_history", postgresql.JSON(), nullable=True),
        sa.Column("allergies", sa.Text(), nullable=True),
        sa.Column("current_medications", sa.Text(), nullable=True),
        sa.Column(
            "created_by_doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctor_profiles.id"), nullable=True
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "scans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patient_profiles.id"), nullable=False
        ),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctor_profiles.id"), nullable=False),
        sa.Column("module", screening_module, nullable=False),
        sa.Column("scan_date", sa.Date(), nullable=True),
        sa.Column("image_path", sa.String(500), nullable=True),
        sa.Column("image_quality", sa.String(50), nullable=True),
        sa.Column("status", scan_status, nullable=False, server_default="draft"),
        sa.Column("clinical_inputs", postgresql.JSON(), nullable=True),
        sa.Column("image_model_score", sa.Float(), nullable=True),
        sa.Column("formula_score", sa.Float(), nullable=True),
        sa.Column("fusion_score", sa.Float(), nullable=True),
        sa.Column("risk_level", risk_level, nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("confidence_explanation", sa.Text(), nullable=True),
        sa.Column("reasoning", postgresql.JSON(), nullable=True),
        sa.Column("ai_suggestions", postgresql.JSON(), nullable=True),
        sa.Column("doctor_modifications", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("scans.id"), nullable=False),
        sa.Column(
            "patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patient_profiles.id"), nullable=False
        ),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctor_profiles.id"), nullable=False),
        sa.Column("report_number", sa.String(100), nullable=False, unique=True),
        sa.Column("status", report_status, nullable=False, server_default="draft"),
        sa.Column("content", postgresql.JSON(), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctor_profiles.id"), nullable=True),
        sa.Column("shared_with_patient", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("shared_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pdf_path", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "appointments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patient_profiles.id"), nullable=False
        ),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctor_profiles.id"), nullable=False),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("scans.id"), nullable=True),
        sa.Column("appointment_type", sa.String(100), nullable=True),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("scheduled_time", sa.Time(), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("status", appointment_status, nullable=False, server_default="scheduled"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("ai_recommended", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("doctor_override", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "referrals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patient_profiles.id"), nullable=False
        ),
        sa.Column(
            "from_doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctor_profiles.id"), nullable=False
        ),
        sa.Column("to_specialist", sa.String(255), nullable=True),
        sa.Column("specialty", sa.String(255), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("priority", referral_priority, nullable=False, server_default="routine"),
        sa.Column("attachments", postgresql.JSON(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("user_type", sa.String(50), nullable=True),
        sa.Column("action", sa.String(255), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=True),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("details", postgresql.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "data_deletion_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patient_profiles.id"), nullable=False
        ),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("request_type", sa.String(100), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("data_deletion_requests")
    op.drop_table("audit_logs")
    op.drop_table("referrals")
    op.drop_table("appointments")
    op.drop_table("reports")
    op.drop_table("scans")
    op.drop_table("patient_profiles")
    op.drop_table("doctor_profiles")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    referral_priority.drop(bind, checkfirst=True)
    appointment_status.drop(bind, checkfirst=True)
    report_status.drop(bind, checkfirst=True)
    risk_level.drop(bind, checkfirst=True)
    scan_status.drop(bind, checkfirst=True)
    screening_module.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
