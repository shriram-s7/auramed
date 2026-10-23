"""Persistent patient requests, separate from confirmed bookings."""
from alembic import op
import sqlalchemy as sa

revision = '0006_appointment_requests'
down_revision = '0005_care_message_delivery'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('appointment_requests',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('appointment_id', sa.Uuid(), sa.ForeignKey('appointments.id'), nullable=False),
        sa.Column('patient_id', sa.Uuid(), sa.ForeignKey('patient_profiles.id'), nullable=False),
        sa.Column('doctor_id', sa.Uuid(), sa.ForeignKey('doctor_profiles.id'), nullable=False),
        sa.Column('preferred_date', sa.Date(), nullable=False),
        sa.Column('preferred_time', sa.Time(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('response', sa.Text()))


def downgrade():
    op.drop_table('appointment_requests')
