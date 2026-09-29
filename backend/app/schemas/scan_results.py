import uuid
from datetime import date, datetime

from pydantic import BaseModel


class ScanResultPatient(BaseModel):
    id: uuid.UUID
    full_name: str
    patient_code: str
    age: int | None
    gender: str | None


from typing import Any


class ImageFinding(BaseModel):
    description: str | None = None
    finding: str | None = None
    confidence: float

    def model_post_init(self, __context: Any) -> None:
        if not self.description and self.finding:
            self.description = self.finding
        elif not self.finding and self.description:
            self.finding = self.description


class ClinicalContribution(BaseModel):
    factor: str | None = None
    factor_name: str | None = None
    value: str | float | int | None = None
    reference_range: str | None = None
    reference: str | None = None
    contribution: float | None = None
    contribution_magnitude: float | None = None

    def model_post_init(self, __context: Any) -> None:
        if not self.factor and self.factor_name:
            self.factor = self.factor_name
        elif not self.factor_name and self.factor:
            self.factor_name = self.factor
        if self.contribution is None and self.contribution_magnitude is not None:
            self.contribution = self.contribution_magnitude
        elif self.contribution_magnitude is None and self.contribution is not None:
            self.contribution_magnitude = self.contribution
        if self.contribution is None:
            self.contribution = 0.0
        if not self.factor:
            self.factor = "Clinical Factor"
        if not self.reference_range and self.reference:
            self.reference_range = self.reference
        elif not self.reference and self.reference_range:
            self.reference = self.reference_range


class FusionWeights(BaseModel):
    image: float
    clinical: float


class DoctorReviewField(BaseModel):
    key: str
    label: str
    type: str
    options: list[str] | None = None
    ai_value: object
    doctor_value: object


class ScanResultsResponse(BaseModel):
    scan_id: uuid.UUID
    module: str
    scan_type_label: str
    status: str
    scan_date: date | None
    image_path: str | None
    image_quality: str | None
    clinical_indication: str
    referring_physician: str
    analysis_datetime: datetime

    patient: ScanResultPatient

    image_findings: list[ImageFinding]
    model_interpretation: str
    image_model_name: str
    image_model_score: float | None
    grad_cam_base64: str | None = None
    gradcam_heatmap_b64: str | None = None
    clinical_reasoning: str | None = None

    clinical_model_name: str
    clinical_contributions: list[ClinicalContribution]
    formula_score: float | None
    formula_result: dict | None = None

    fusion_weights: FusionWeights
    fusion_score: float | None
    risk_level: str | None
    confidence_score: float | None
    confidence_reasons: list[str]
    limitations: list[str]

    follow_up_interval: str
    ai_suggestions: dict
    doctor_modifications: dict
    doctor_review_fields: list[DoctorReviewField]
    doctor_review_notes: str | None

    clinical_inputs: dict
    is_urgent: bool

    criterion_oligo_anovulation: bool | None = None
    criterion_hyperandrogenism: bool | None = None
    criterion_polycystic_ovaries: bool | None = None
    rotterdam_criteria_met: int | None = None
    rotterdam_positive: bool | None = None


class ModificationItem(BaseModel):
    parameter: str
    ai_value: str | None = None
    doctor_value: str | None = None


class DoctorReviewUpdateRequest(BaseModel):
    modifications: list[ModificationItem] | None = None
    values: dict | None = None
    notes: str | None = None


class AuditLogEntry(BaseModel):
    id: uuid.UUID
    action: str
    details: dict | None
    created_at: datetime


class ScheduleFollowupRequest(BaseModel):
    scheduled_date: date
    notes: str | None = None
