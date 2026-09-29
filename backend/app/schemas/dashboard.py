import uuid
from datetime import date, datetime

from pydantic import BaseModel


class StatWithChange(BaseModel):
    value: int
    change_pct: float | None = None


class UpcomingFollowupStat(BaseModel):
    value: int
    within_7_days: int


class CriticalCasesStat(BaseModel):
    value: int


class DashboardStats(BaseModel):
    total_patients: StatWithChange
    scans_analyzed: StatWithChange
    upcoming_followups: UpcomingFollowupStat
    critical_cases: CriticalCasesStat
    total_reports: StatWithChange | None = None


class ActivityPoint(BaseModel):
    date: date
    scans_analyzed: int
    reports_signed: int
    followups_scheduled: int


class UrgentCase(BaseModel):
    scan_id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    module: str
    risk_level: str | None
    reason: str | None
    scan_date: date | None


class UpcomingFollowup(BaseModel):
    appointment_id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    module: str | None
    scheduled_date: date
    days_until: int
    status: str


class RecentScan(BaseModel):
    scan_id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    module: str
    status: str
    risk_level: str | None
    scan_date: date | None
    report_id: uuid.UUID | None
    rotterdam_positive: bool | None = None


class NotificationItem(BaseModel):
    id: uuid.UUID
    message: str
    created_at: datetime


class DashboardSummary(BaseModel):
    stats: DashboardStats
    activity: list[ActivityPoint]
    urgent_cases: list[UrgentCase]
    upcoming_followups: list[UpcomingFollowup]
    recent_scans: list[RecentScan]
