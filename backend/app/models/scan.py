from sqlalchemy import Boolean, Column, Date, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import RiskLevel, ScanStatus, ScreeningModule
from app.models.mixins import TimestampMixin, UUIDPKMixin


class Scan(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "scans"

    patient_id = Column(UUID(as_uuid=True), ForeignKey("patient_profiles.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctor_profiles.id"), nullable=False)
    module = Column(Enum(ScreeningModule, name="screening_module"), nullable=False)
    scan_date = Column(Date, nullable=True)
    image_path = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)
    image_quality = Column(String(50), nullable=True)
    status = Column(Enum(ScanStatus, name="scan_status"), nullable=False, default=ScanStatus.draft)
    clinical_inputs = Column(JSON, nullable=True)
    image_model_score = Column(Float, nullable=True)
    formula_score = Column(Float, nullable=True)
    fusion_score = Column(Float, nullable=True)
    risk_level = Column(Enum(RiskLevel, name="risk_level"), nullable=True)
    confidence_score = Column(Float, nullable=True)
    confidence_explanation = Column(Text, nullable=True)
    reasoning = Column(JSON, nullable=True)
    ai_suggestions = Column(JSON, nullable=True)
    doctor_modifications = Column(JSON, nullable=True)
    criterion_oligo_anovulation = Column(Boolean, nullable=True)
    criterion_hyperandrogenism = Column(Boolean, nullable=True)
    criterion_polycystic_ovaries = Column(Boolean, nullable=True)
    rotterdam_criteria_met = Column(Integer, nullable=True)
    rotterdam_positive = Column(Boolean, nullable=True)

    patient = relationship("PatientProfile", foreign_keys=[patient_id])
    doctor = relationship("DoctorProfile", foreign_keys=[doctor_id])


ScanResult = Scan
