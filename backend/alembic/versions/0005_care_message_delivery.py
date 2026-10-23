"""Persist message idempotency, provider receipts and retry state."""
from alembic import op
import sqlalchemy as sa

revision = "0005_care_message_delivery"
down_revision = "0004_patient_notes_and_urgent"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("notifications", sa.Column("dedupe_key", sa.String(255)))
    op.add_column("notifications", sa.Column("provider_id", sa.String(100)))
    op.add_column("notifications", sa.Column("last_error", sa.Text()))
    op.add_column("notifications", sa.Column("next_attempt_at", sa.DateTime(timezone=True)))
    op.create_index("ix_notifications_dedupe_key", "notifications", ["dedupe_key"], unique=True)


def downgrade():
    op.drop_index("ix_notifications_dedupe_key", table_name="notifications")
    for name in ("next_attempt_at", "last_error", "provider_id", "dedupe_key"):
        op.drop_column("notifications", name)
