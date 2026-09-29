import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class PatientStat(BaseModel):
    value: int
    change_pct: float | None = None


class HighRiskStat(BaseModel):
    value: int
    pct_of_total: float


class FollowupsDueStat(BaseModel):
    value: int


class PatientStats(BaseModel):
    total_patients: PatientStat
    total_scans: PatientStat
    high_risk: HighRiskStat
    followups_due: FollowupsDueStat


class PatientListItem(BaseModel):
    id: uuid.UUID
    patient_id: str
    patient_code: str
    full_name: str
    date_of_birth: date | None = None
    age: int | None = None
    gender: str | None = None
    phone: str | None = None
    email: str | None = None
    status: str
    modules_used: list[str] = []
    modules: list[str] = []
    last_scan_date: date | None = None
    last_scan_risk_level: str | None = None
    risk_level: str | None = None
    next_followup_date: date | None = None
    created_at: datetime | None = None


class PatientListResponse(BaseModel):
    items: list[PatientListItem]
    total: int
    page: int
    limit: int
    page_size: int
    total_pages: int


class ConsentPayload(BaseModel):
    data_storage_and_ai_analysis: bool = False
    share_with_referring_physicians: bool = False
    appointment_reminders: bool = False
    research_contact: bool = False
    delete_on_account_closure: bool = False


class PatientCreateRequest(BaseModel):
    full_name: str
    date_of_birth: date
    gender: str | None = None
    phone: str
    email: EmailStr | None = None
    address: str | None = None
    pin_code: str | None = None
    blood_group: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None
    family_history: dict | None = None
    personal_medical_history: dict | None = None
    allergies: str | None = None
    current_medications: str | None = None
    overall_notes: str | None = None
    additional_notes: str | None = None
    consent: ConsentPayload | dict[str, Any] | None = None
    preferred_modules: list[str] = []


class PatientCreateResponse(BaseModel):
    patient_id: uuid.UUID
    patient_code: str
    generated_patient_id: str
    full_name: str
    temporary_password: str
    created_at: datetime
    email: str | None = None
    message: str = "Patient registered successfully"


class PatientStatusUpdateRequest(BaseModel):
    status: str
