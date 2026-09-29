import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.mixins import UUIDPKMixin


class DoctorSession(Base, UUIDPKMixin):
    __tablename__ = "doctor_sessions"

    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    token_jti = Column(String(255), nullable=True, index=True)
    device = Column(String(100), nullable=True, default="Desktop Workstation")
    browser = Column(String(100), nullable=True, default="Chrome")
    ip = Column(String(64), nullable=True)
    location = Column(String(255), nullable=True, default="Chennai, Tamil Nadu, India")
    last_active = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_revoked = Column(Boolean, nullable=False, default=False)
    is_expired = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    doctor = relationship("DoctorProfile", foreign_keys=[doctor_id])
    user = relationship("User", foreign_keys=[user_id])
