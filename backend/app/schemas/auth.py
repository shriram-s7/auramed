import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class UnifiedLoginRequest(BaseModel):
    email: str
    password: str


class DoctorLoginRequest(BaseModel):
    identifier: str = Field(..., description="Email or doctor ID (registration number)")
    password: str
    registration_number: str


class PatientLoginRequest(BaseModel):
    identifier: str = Field(..., description="Patient ID (e.g. P-2026-0001) or email")
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    role: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class DoctorRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str
    registration_number: str
    specialty: str | None = None
    hospital: str | None = None
    phone: str | None = None


class DoctorRegisterResponse(BaseModel):
    message: str
    user_id: uuid.UUID
    is_approved: bool


class PatientRegisterRequest(BaseModel):
    email: EmailStr | None = None
    full_name: str
    date_of_birth: date | None = None
    gender: str | None = None
    phone: str | None = None
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


class PatientRegisterResponse(BaseModel):
    message: str
    patient_id: uuid.UUID
    patient_code: str
    email: EmailStr | None
    temporary_password: str


class PatientSelfRegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    date_of_birth: date | None = None
    gender: str | None = "Female"
    phone: str | None = None
    address: str | None = None


class PatientSelfRegisterResponse(BaseModel):
    message: str
    access_token: str
    refresh_token: str
    role: str
    user_id: str
    patient_code: str
    expires_in: int


class UserMeResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    profile: dict | None = None

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str
