"""add consent, preferred_modules, status to patient_profiles

Revision ID: 0003_patient_extra_fields
Revises: 0002_add_patient_code
Create Date: 2026-09-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003_patient_extra_fields"
down_revision: Union[str, None] = "0002_add_patient_code"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("patient_profiles", sa.Column("consent", postgresql.JSON(), nullable=True))
    op.add_column("patient_profiles", sa.Column("preferred_modules", postgresql.JSON(), nullable=True))
    op.add_column(
        "patient_profiles",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
    )
    op.alter_column("patient_profiles", "status", server_default=None)


def downgrade() -> None:
    op.drop_column("patient_profiles", "status")
    op.drop_column("patient_profiles", "preferred_modules")
    op.drop_column("patient_profiles", "consent")
