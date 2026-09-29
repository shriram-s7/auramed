from sqlalchemy import Boolean, Column, Date, Enum, ForeignKey, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, synonym

from app.core.database import Base
from app.models.enums import AppointmentStatus
from app.models.mixins import TimestampMixin, UUIDPKMixin


class Appointment(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "appointments"

    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctor_profiles.id"), nullable=False)
    scan_id = Column(UUID(as_uuid=True), ForeignKey("scans.id"), nullable=True)
    appointment_type = Column(String(100), nullable=True)
    scheduled_date = Column(Date, nullable=False)
    scheduled_time = Column(Time, nullable=True)
    location = Column(String(255), nullable=True)
    status = Column(
        Enum(AppointmentStatus, name="appointment_status"),
        nullable=False,
        default=AppointmentStatus.scheduled,
    )
    notes = Column(Text, nullable=True)
    ai_recommended = Column(Boolean, nullable=False, default=False)
    doctor_override = Column(Boolean, nullable=False, default=False)
    reminder_sent = Column(Boolean, nullable=False, default=False)

    # Property synonyms to support both naming styles seamlessly
    date = synonym("scheduled_date")
    time = synonym("scheduled_time")
    type = synonym("appointment_type")

    patient = relationship("PatientProfile", foreign_keys=[patient_id])
    doctor = relationship("DoctorProfile", foreign_keys=[doctor_id])
    scan = relationship("Scan", foreign_keys=[scan_id])
