"""add is_urgent, overall_notes, notes to patient_profiles

Revision ID: 0004_patient_notes_and_urgent
Revises: 0003_patient_extra_fields
Create Date: 2026-09-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0004_patient_notes_and_urgent"
down_revision: Union[str, None] = "0003_patient_extra_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "patient_profiles",
        sa.Column("is_urgent", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("patient_profiles", sa.Column("overall_notes", sa.Text(), nullable=True))
    op.add_column("patient_profiles", sa.Column("notes", postgresql.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("patient_profiles", "notes")
    op.drop_column("patient_profiles", "overall_notes")
    op.drop_column("patient_profiles", "is_urgent")
