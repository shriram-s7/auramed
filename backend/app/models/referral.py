from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import ReferralPriority
from app.models.mixins import UUIDPKMixin


class Referral(Base, UUIDPKMixin):
    __tablename__ = "referrals"

    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.id"), nullable=False)
    from_doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctor_profiles.id"), nullable=False)
    to_specialist = Column(String(255), nullable=True)
    specialty = Column(String(255), nullable=True)
    reason = Column(Text, nullable=True)
    priority = Column(
        Enum(ReferralPriority, name="referral_priority"), nullable=False, default=ReferralPriority.routine
    )
    attachments = Column(JSON, nullable=True)
    status = Column(String(50), nullable=False, default="pending")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    patient = relationship("PatientProfile", foreign_keys=[patient_id])
    from_doctor = relationship("DoctorProfile", foreign_keys=[from_doctor_id])
