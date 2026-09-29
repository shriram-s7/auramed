from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.mixins import UUIDPKMixin


class DoctorProfile(Base, UUIDPKMixin):
    __tablename__ = "doctor_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    full_name = Column(String(255), nullable=False)
    registration_number = Column(String(100), nullable=False, unique=True)
    specialty = Column(String(255), nullable=True)
    hospital = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    notification_preferences = Column(JSON, nullable=True)
    clinical_preferences = Column(JSON, nullable=True)
    two_factor_enabled = Column(Boolean, nullable=False, default=False)
    is_approved = Column(Boolean, nullable=False, default=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="doctor_profile", foreign_keys=[user_id])

