from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.mixins import UUIDPKMixin


class DataDeletionRequest(Base, UUIDPKMixin):
    __tablename__ = "data_deletion_requests"

    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.id"), nullable=False)
    reason = Column(Text, nullable=True)
    request_type = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="pending")
    requested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    patient = relationship("PatientProfile", foreign_keys=[patient_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
