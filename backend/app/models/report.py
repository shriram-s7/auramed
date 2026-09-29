from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import ReportStatus
from app.models.mixins import TimestampMixin, UUIDPKMixin


class Report(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "reports"

    scan_id = Column(UUID(as_uuid=True), ForeignKey("scans.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctor_profiles.id"), nullable=False)
    report_number = Column(String(100), nullable=False, unique=True)
    status = Column(Enum(ReportStatus, name="report_status"), nullable=False, default=ReportStatus.draft)
    content = Column(JSON, nullable=True)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    signed_by = Column(UUID(as_uuid=True), ForeignKey("doctor_profiles.id"), nullable=True)
    shared_with_patient = Column(Boolean, nullable=False, default=False)
    shared_at = Column(DateTime(timezone=True), nullable=True)
    pdf_path = Column(String(500), nullable=True)

    scan = relationship("Scan", foreign_keys=[scan_id])
    patient = relationship("PatientProfile", foreign_keys=[patient_id])
    doctor = relationship("DoctorProfile", foreign_keys=[doctor_id])
    signed_by_doctor = relationship("DoctorProfile", foreign_keys=[signed_by])
