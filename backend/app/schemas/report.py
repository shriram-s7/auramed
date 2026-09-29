import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class ReportSectionPatientInfo(BaseModel):
    name: str = "Patient"
    patient_id: str = "P-2026-0001"
    age: int | None = None
    gender: str | None = None
    date_of_scan: str | None = None
    referring_physician: str = "Attending Physician"
    scan_type: str = "Diagnostic Screening"
    indication: str = "Clinical Routine Screening"
    report_date: str = ""


class ClinicalFactorItem(BaseModel):
    name: str
    value: str
    impact: str = "neutral"


class ReportSectionClinicalSummary(BaseModel):
    summary_text: str
    factors: list[ClinicalFactorItem] = Field(default_factory=list)


class ImagingFindingItem(BaseModel):
    title: str
    description: str


class ReportSectionImagingFindings(BaseModel):
    description: str
    findings_bullets: list[str] = Field(default_factory=list)
    image_labels: list[str] = Field(
        default_factory=lambda: [
            "Main Scan View",
            "Contralateral / Secondary View",
            "AI Focus Area Zoomed",
            "AI Segmentation Overlay",
        ]
    )
    main_image_url: str | None = None
    secondary_image_url: str | None = None
    gradcam_heatmap_b64: str | None = None
    segmentation_image_url: str | None = None


class AssessmentRow(BaseModel):
    component: str
    result: str
    interpretation: str
    score: float | None = None


class ReportSectionAiAssessment(BaseModel):
    rows: list[AssessmentRow] = Field(default_factory=list)


class ReportSectionRiskAssessment(BaseModel):
    risk_level: str
    label: str
    recommendation_sentence: str


class ReportSectionRecommendations(BaseModel):
    recommendations_list: list[str] = Field(default_factory=list)
    ai_insight_explanation: str


class ReportOptions(BaseModel):
    include_images: bool = True
    include_ai_details: bool = True
    include_reference_ranges: bool = True
    include_disclaimers: bool = True
    include_rotterdam: bool = True


class AddendumItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    doctor_name: str
    registration_number: str
    created_at: str
    note: str


class RotterdamCriteriaRow(BaseModel):
    criterion: str
    status: str
    basis: str


class ReportSectionRotterdamCriteria(BaseModel):
    criterion_oligo_anovulation: bool | None = None
    criterion_hyperandrogenism: bool | None = None
    criterion_polycystic_ovaries: bool | None = None
    oligo_anovulation: bool | None = None
    hyperandrogenism: bool | None = None
    polycystic_ovaries: bool | None = None
    criteria_met: int = 0
    criteria_met_count: int = 0
    rotterdam_positive: bool = False
    diagnosis: str = "NEGATIVE"
    note: str = ""
    clinical_note: str = ""
    rows: list[RotterdamCriteriaRow] = Field(default_factory=list)


class ReportContent(BaseModel):
    template: str = "Standard Clinical Report"
    options: ReportOptions = Field(default_factory=ReportOptions)
    patient_information: ReportSectionPatientInfo | None = None
    patient_info: ReportSectionPatientInfo | None = None
    clinical_summary: ReportSectionClinicalSummary | None = None
    imaging_findings: ReportSectionImagingFindings | None = None
    ai_and_clinical_assessment: ReportSectionAiAssessment | None = None
    ai_assessment: ReportSectionAiAssessment | None = None
    rotterdam_criteria: ReportSectionRotterdamCriteria | dict[str, Any] | None = None
    risk_assessment: ReportSectionRiskAssessment | None = None
    recommendations: ReportSectionRecommendations | None = None
    sections: dict[str, Any] = Field(default_factory=dict)
    addendums: list[dict[str, Any]] = Field(default_factory=list)


class ReportDetailResponse(BaseModel):
    id: uuid.UUID
    scan_id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    report_number: str
    status: str
    content: ReportContent
    signed_at: datetime | None = None
    signed_by: uuid.UUID | None = None
    signed_by_details: str | None = None
    signed_by_doctor_name: str | None = None
    signed_by_doctor_reg: str | None = None
    signed_by_doctor_specialty: str | None = None
    signed_by_doctor_hospital: str | None = None
    shared_with_patient: bool = False
    shared_at: datetime | None = None
    pdf_path: str | None = None
    created_at: datetime
    updated_at: datetime

    module: str
    risk_level: str | None = None
    scan_date: str | None = None
    report_date: str | None = None
    patient_name: str
    patient_code: str
    patient_age: int | None = None
    patient_gender: str | None = None
    patient_phone: str | None = None
    image_url: str | None = None
    image_path: str | None = None
    grad_cam_base64: str | None = None
    gradcam_heatmap_b64: str | None = None
    audit_trail: list[dict[str, Any]] = Field(default_factory=list)


class CreateReportRequest(BaseModel):
    scan_id: str


class PatchReportRequest(BaseModel):
    sections: dict[str, Any] | None = None
    options: ReportOptions | dict[str, Any] | None = None
    template: str | None = None
    content: ReportContent | dict[str, Any] | None = None


class ReportSaveDraftRequest(BaseModel):
    content: ReportContent | dict[str, Any]


class AddAddendumRequest(BaseModel):
    addendum_text: str | None = None
    note: str | None = None
    content: str | None = None


class ShareReportRequest(BaseModel):
    share_with_patient: bool = True
    delivery_method: str = "portal"
    share_with_physician: bool = False
    physician_id: str | None = None
    message: str | None = None


class SignReportResponse(BaseModel):
    status: str
    signed_at: datetime
    signed_by: str
    report_number: str | None = None


class ShareReportResponse(BaseModel):
    shared: bool
    shared_at: datetime


class MessageResponse(BaseModel):
    message: str

