from sqlalchemy import Column, Date, ForeignKey, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class AppointmentRequest(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = 'appointment_requests'
    appointment_id = Column(UUID(as_uuid=True), ForeignKey('appointments.id'), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patient_profiles.id'), nullable=False)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey('doctor_profiles.id'), nullable=False)
    preferred_date = Column(Date, nullable=False)
    preferred_time = Column(Time, nullable=False)
    reason = Column(Text, nullable=False, default='')
    status = Column(String(20), nullable=False, default='pending')
    response = Column(Text, nullable=True)
