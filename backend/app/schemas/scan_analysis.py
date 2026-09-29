import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class ScanUploadResponse(BaseModel):
    scan_id: uuid.UUID
    image_path: str
    file_size: int
    file_name: str
    upload_timestamp: datetime
    status: str = "draft"


class ConfidenceExplanation(BaseModel):
    reasons_high: list[str] = []
    reasons_low: list[str] = []
    overall: str = ""


class ImageFindingItem(BaseModel):
    finding: str
    confidence: float


class ClinicalContributionItem(BaseModel):
    factor: str
    value: Any
    reference: str = "-"
    contribution: float


class ReasoningDetail(BaseModel):
    image_findings: list[ImageFindingItem] = []
    image_interpretation: str = ""
    clinical_contributions: list[ClinicalContributionItem] = []
    clinical_score_basis: str = ""


class ScanAnalyzeResponse(BaseModel):
    scan_id: uuid.UUID
    module: str
    status: str
    image_model_score: float | None = None
    formula_score: float | None = None
    fusion_score: float | None = None
    risk_level: str | None = None
    confidence_score: float | None = None
    confidence_explanation: ConfidenceExplanation | str | None = None
    reasoning: ReasoningDetail | dict[str, Any] | None = None
    formula_result: dict[str, Any] | None = None
    fusion_result: dict[str, Any] | None = None
    confidence_result: dict[str, Any] | None = None
    grad_cam_base64: str | None = None
    gradcam_heatmap_b64: str | None = None
    clinical_reasoning: str | None = None
    recommended_followup_days: int | None = None
    recommended_actions: list[str] = []
    criterion_oligo_anovulation: bool | None = None
    criterion_hyperandrogenism: bool | None = None
    criterion_polycystic_ovaries: bool | None = None
    rotterdam_criteria_met: int | None = None
    rotterdam_positive: bool | None = None


class ScanDraftResponse(BaseModel):
    scan_id: uuid.UUID
    module: str
    status: str
    message: str


class ScanDraftRequest(BaseModel):
    patient_id: uuid.UUID
    module: str
    clinical_inputs: dict
    scan_date: date | None = None


class ScanDetailRecord(BaseModel):
    id: uuid.UUID
    scan_id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    module: str
    scan_date: date | None
    image_path: str | None
    file_name: str | None = None
    file_size: int | None = None
    image_quality: str | None
    status: str
    clinical_inputs: dict | None
    image_model_score: float | None
    formula_score: float | None
    formula_result: dict[str, Any] | None = None
    fusion_result: dict[str, Any] | None = None
    confidence_result: dict[str, Any] | None = None
    grad_cam_base64: str | None = None
    gradcam_heatmap_b64: str | None = None
    fusion_score: float | None
    risk_level: str | None
    confidence_score: float | None
    confidence_explanation: Any | None
    reasoning: Any | None
    ai_suggestions: Any | None
    doctor_modifications: Any | None
    recommended_actions: list[str] = []
    recommended_followup_days: int | None = None
    criterion_oligo_anovulation: bool | None = None
    criterion_hyperandrogenism: bool | None = None
    criterion_polycystic_ovaries: bool | None = None
    rotterdam_criteria_met: int | None = None
    rotterdam_positive: bool | None = None
    created_at: datetime
    updated_at: datetime | None = None
