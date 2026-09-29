import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    doctor = "doctor"
    patient = "patient"


class ScreeningModule(str, enum.Enum):
    breast = "breast"
    cervical = "cervical"
    pcos = "pcos"


class ScanStatus(str, enum.Enum):
    draft = "draft"
    analyzing = "analyzing"
    analyzed = "analyzed"
    reported = "reported"
    archived = "archived"


class RiskLevel(str, enum.Enum):
    low = "low"
    moderate = "moderate"
    high = "high"
    critical = "critical"


class ReportStatus(str, enum.Enum):
    draft = "draft"
    approved = "approved"
    signed = "signed"
    shared_with_patient = "shared_with_patient"
    addendum = "addendum"


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"
    rescheduled = "rescheduled"


class ReferralPriority(str, enum.Enum):
    routine = "routine"
    urgent = "urgent"
    emergency = "emergency"
