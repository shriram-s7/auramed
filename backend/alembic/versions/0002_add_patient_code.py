"""add patient_code to patient_profiles

Revision ID: 0002_add_patient_code
Revises: 0001_initial_schema
Create Date: 2026-09-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_add_patient_code"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "patient_profiles",
        sa.Column("patient_code", sa.String(length=20), nullable=False, server_default="P-0000-0000"),
    )
    op.alter_column("patient_profiles", "patient_code", server_default=None)
    op.create_unique_constraint("uq_patient_profiles_patient_code", "patient_profiles", ["patient_code"])


def downgrade() -> None:
    op.drop_constraint("uq_patient_profiles_patient_code", "patient_profiles", type_="unique")
    op.drop_column("patient_profiles", "patient_code")
