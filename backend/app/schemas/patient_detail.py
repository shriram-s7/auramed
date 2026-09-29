import datetime
from typing import Any
import uuid

from pydantic import BaseModel


class PatientDetailInfo(BaseModel):
    id: uuid.UUID
    patient_id: str
    patient_code: str
    full_name: str
    status: str
    is_urgent: bool
    date_of_birth: datetime.date | None = None
    age: int | None = None
    gender: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    pin_code: str | None = None
    blood_group: str | None = None
    allergies: str | None = None
    current_medications: str | None = None
    family_history: dict | None = None
    personal_medical_history: dict | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None
    overall_notes: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime | None = None


class QuickInfo(BaseModel):
    blood_group: str | None
    allergies_summary: str | None
    relevant_history_summary: str | None
    last_visit_date: datetime.date | None
    next_followup_date: datetime.date | None
    next_followup_overdue: bool
    next_followup_soon: bool


class ModuleStatus(BaseModel):
    module: str
    has_scans: bool
    last_scan_date: datetime.date | None
    last_scan_id: uuid.UUID | None
    risk_level: str | None
    next_followup_date: datetime.date | None


class TimelineEvent(BaseModel):
    id: str
    date: datetime.datetime
    type: str | None = None
    event_type: str
    title: str
    description: str | None = None
    badge: str | None = None
    risk_level: str | None = None
    reference_id: uuid.UUID | None = None
    related_id: str | None = None
    module: str | None = None
    icon_type: str | None = None


class RecentScanItem(BaseModel):
    scan_id: uuid.UUID
    module: str
    scan_date: datetime.date | None
    risk_level: str | None
    status: str
    rotterdam_positive: bool | None = None


class RiskTrendPoint(BaseModel):
    date: datetime.date | None = None
    scan_date: datetime.date | None = None
    score: float | None = None
    fusion_score: float | None = None
    risk_level: str | None = None


class TrajectoryResultSchema(BaseModel):
    data_points: list[dict[str, Any]] = []
    trend_direction: str
    trend_slope: float
    trend_explanation: str
    trajectory_risk: str


class PatientRiskTrendResponse(BaseModel):
    data_points: list[dict[str, Any]]
    trajectory: TrajectoryResultSchema
    module: str


class ScanRow(BaseModel):
    id: uuid.UUID
    module: str
    scan_date: datetime.date | None
    image_quality: str | None
    risk_level: str | None
    confidence_score: float | None
    status: str
    doctor_name: str | None
    clinical_inputs: dict | None
    reasoning: dict | list | None
    criterion_oligo_anovulation: bool | None = None
    criterion_hyperandrogenism: bool | None = None
    criterion_polycystic_ovaries: bool | None = None
    rotterdam_criteria_met: int | None = None
    rotterdam_positive: bool | None = None


class ReportRow(BaseModel):
    id: uuid.UUID
    scan_id: uuid.UUID
    report_number: str
    status: str
    signed_at: datetime.datetime | None
    shared_with_patient: bool
    pdf_path: str | None
    created_at: datetime.datetime


class AppointmentRow(BaseModel):
    id: uuid.UUID
    appointment_type: str | None
    scheduled_date: datetime.date
    scheduled_time: str | None
    location: str | None
    status: str
    notes: str | None
    ai_recommended: bool
    doctor_override: bool


class FollowupPlanItem(BaseModel):
    module: str
    ai_recommended_date: datetime.date | None
    doctor_set_date: datetime.date | None
    status: str | None


class NoteRow(BaseModel):
    id: str
    text: str
    created_at: datetime.datetime


class ReferralRow(BaseModel):
    id: uuid.UUID
    to_specialist: str | None
    specialty: str | None
    reason: str | None
    priority: str
    status: str
    created_at: datetime.datetime


class PatientDetailResponse(BaseModel):
    patient: PatientDetailInfo
    quick_info: QuickInfo
    modules: list[ModuleStatus]
    timeline: list[TimelineEvent]
    recent_scans: list[RecentScanItem]
    risk_trend: dict[str, list[RiskTrendPoint]]
    scans: list[ScanRow]
    reports: list[ReportRow]
    appointments: list[AppointmentRow]
    follow_up_plan: list[FollowupPlanItem]
    notes: list[NoteRow]
    referrals: list[ReferralRow]
    total_scans: int = 0
    scans_by_module: dict[str, int] = {}
    latest_risk_per_module: dict[str, str | None] = {}
    next_followup_dates: dict[str, datetime.date | None] = {}


class PatientUpdateRequest(BaseModel):
    full_name: str | None = None
    date_of_birth: datetime.date | None = None
    gender: str | None = None
    phone: str | None = None
    address: str | None = None
    pin_code: str | None = None
    blood_group: str | None = None
    allergies: str | None = None
    current_medications: str | None = None
    family_history: dict | None = None
    personal_medical_history: dict | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None


class OverallNotesUpdateRequest(BaseModel):
    overall_notes: str


class NoteCreateRequest(BaseModel):
    text: str


class UrgentFlagResponse(BaseModel):
    is_urgent: bool
