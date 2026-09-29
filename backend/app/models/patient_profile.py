from sqlalchemy import Boolean, Column, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship, synonym


from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class PatientProfile(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "patient_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    patient_code = Column(String(20), nullable=False, unique=True)
    full_name = Column(String(255), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    pin_code = Column(String(20), nullable=True)
    blood_group = Column(String(10), nullable=True)
    emergency_contact_name = Column(String(255), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    emergency_contact_relation = Column(String(100), nullable=True)
    family_history = Column(JSON, nullable=True)
    personal_medical_history = Column(JSON, nullable=True)
    allergies = Column(Text, nullable=True)
    current_medications = Column(Text, nullable=True)
    consent = Column(JSON, nullable=True)
    preferred_modules = Column(JSON, nullable=True)
    status = Column(String(20), nullable=False, default="active")
    is_urgent = Column(Boolean, nullable=False, default=False)
    overall_notes = Column(Text, nullable=True)
    notes = Column(JSON, nullable=True)
    created_by_doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctor_profiles.id"), nullable=True)
    doctor_id = synonym("created_by_doctor_id")

    user = relationship("User", back_populates="patient_profile", foreign_keys=[user_id])

    created_by_doctor = relationship("DoctorProfile", foreign_keys=[created_by_doctor_id])
