import re
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class DoctorProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    specialty: Optional[str] = None
    hospital: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            cleaned = re.sub(r"[\s\-()]+", "", v)
            if not re.match(r"^(\+)?[0-9]{7,16}$", cleaned):
                raise ValueError("Invalid phone number format. Must contain 7 to 16 digits.")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_new_password: Optional[str] = None


class DoctorSessionItem(BaseModel):
    id: str
    device: str
    browser: str
    ip: Optional[str] = None
    ip_address: Optional[str] = None
    location: Optional[str] = "Chennai, Tamil Nadu, India"
    last_active: str
    is_current: bool = False


class AdminSettingsUpdateRequest(BaseModel):
    section: str
    settings: Dict[str, Any]


class FeatureFlagUpdateRequest(BaseModel):
    flag_name: str
    enabled: bool


class PatientProfileUpdateRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            cleaned = re.sub(r"[\s\-()]+", "", v)
            if not re.match(r"^(\+)?[0-9]{7,16}$", cleaned):
                raise ValueError("Invalid phone number format. Must contain 7 to 16 digits.")
        return v
