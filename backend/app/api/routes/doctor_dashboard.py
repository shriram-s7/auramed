from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor_profile
from app.core.database import get_db
from app.models.appointment import Appointment
from app.models.audit_log import AuditLog
from app.models.doctor_profile import DoctorProfile
from app.models.enums import AppointmentStatus, RiskLevel, ScanStatus
from app.models.patient_profile import PatientProfile
from app.models.report import Report
from app.models.scan import Scan
from app.schemas.dashboard import (
    ActivityPoint,
    CriticalCasesStat,
    DashboardStats,
    DashboardSummary,
    NotificationItem,
    RecentScan,
    StatWithChange,
    UpcomingFollowup,
    UpcomingFollowupStat,
    UrgentCase,
)

router = APIRouter(prefix="/api/doctor/dashboard", tags=["doctor-dashboard"])


def _pct_change(current: int, previous: int) -> float | None:
    if previous == 0:
        return None if current == 0 else 100.0
    return round((current - previous) / previous * 100, 1)


def _month_bounds(reference: date) -> tuple[date, date, date, date]:
    this_month_start = reference.replace(day=1)
    last_month_end = this_month_start - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    return this_month_start, reference, last_month_start, last_month_end


def _compute_stats(db: Session, doctor: DoctorProfile) -> DashboardStats:
    today = date.today()
    this_start, this_end, last_start, last_end = _month_bounds(today)

    total_patients = (
        db.query(PatientProfile).filter(PatientProfile.created_by_doctor_id == doctor.id).count()
    )
    patients_this_month = (
        db.query(PatientProfile)
        .filter(
            PatientProfile.created_by_doctor_id == doctor.id,
            func.date(PatientProfile.created_at) >= this_start,
        )
        .count()
    )
    patients_last_month = (
        db.query(PatientProfile)
        .filter(
            PatientProfile.created_by_doctor_id == doctor.id,
            func.date(PatientProfile.created_at) >= last_start,
            func.date(PatientProfile.created_at) <= last_end,
        )
        .count()
    )

    scans_analyzed_total = (
        db.query(Scan)
        .filter(Scan.doctor_id == doctor.id, Scan.status != ScanStatus.draft)
        .count()
    )
    scans_this_month = (
        db.query(Scan)
        .filter(
            Scan.doctor_id == doctor.id,
            Scan.status != ScanStatus.draft,
            func.date(Scan.created_at) >= this_start,
        )
        .count()
    )
    scans_last_month = (
        db.query(Scan)
        .filter(
            Scan.doctor_id == doctor.id,
            Scan.status != ScanStatus.draft,
            func.date(Scan.created_at) >= last_start,
            func.date(Scan.created_at) <= last_end,
        )
        .count()
    )

    upcoming_total = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.id,
            Appointment.status == AppointmentStatus.scheduled,
            Appointment.scheduled_date >= today,
        )
        .count()
    )
    upcoming_within_7 = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.id,
            Appointment.status == AppointmentStatus.scheduled,
            Appointment.scheduled_date >= today,
            Appointment.scheduled_date <= today + timedelta(days=7),
        )
        .count()
    )

    critical_cases = (
        db.query(Scan)
        .filter(
            Scan.doctor_id == doctor.id,
            Scan.risk_level == RiskLevel.critical,
            Scan.status != ScanStatus.reported,
        )
        .count()
    )

    total_reports = db.query(Report).filter(Report.doctor_id == doctor.id).count()

    return DashboardStats(
        total_patients=StatWithChange(
            value=total_patients, change_pct=_pct_change(patients_this_month, patients_last_month)
        ),
        scans_analyzed=StatWithChange(
            value=scans_analyzed_total, change_pct=_pct_change(scans_this_month, scans_last_month)
        ),
        upcoming_followups=UpcomingFollowupStat(value=upcoming_total, within_7_days=upcoming_within_7),
        critical_cases=CriticalCasesStat(value=critical_cases),
        total_reports=StatWithChange(value=total_reports),
    )


def _compute_activity(db: Session, doctor: DoctorProfile) -> list[ActivityPoint]:
    today = date.today()
    start = today - timedelta(days=29)

    scans = (
        db.query(Scan)
        .filter(
            Scan.doctor_id == doctor.id,
            Scan.status != ScanStatus.draft,
            func.date(Scan.created_at) >= start,
        )
        .all()
    )
    reports = (
        db.query(Report)
        .filter(Report.doctor_id == doctor.id, Report.signed_at.isnot(None))
        .all()
    )
    appointments = (
        db.query(Appointment)
        .filter(Appointment.doctor_id == doctor.id, func.date(Appointment.created_at) >= start)
        .all()
    )

    scans_by_day: dict[date, int] = {}
    for scan in scans:
        d = scan.created_at.date()
        scans_by_day[d] = scans_by_day.get(d, 0) + 1

    reports_by_day: dict[date, int] = {}
    for report in reports:
        if report.signed_at and report.signed_at.date() >= start:
            d = report.signed_at.date()
            reports_by_day[d] = reports_by_day.get(d, 0) + 1

    appts_by_day: dict[date, int] = {}
    for appt in appointments:
        d = appt.created_at.date()
        appts_by_day[d] = appts_by_day.get(d, 0) + 1

    points = []
    for offset in range(30):
        d = start + timedelta(days=offset)
        points.append(
            ActivityPoint(
                date=d,
                scans_analyzed=scans_by_day.get(d, 0),
                reports_signed=reports_by_day.get(d, 0),
                followups_scheduled=appts_by_day.get(d, 0),
            )
        )
    return points


def _compute_urgent_cases(db: Session, doctor: DoctorProfile) -> list[UrgentCase]:
    scans = (
        db.query(Scan)
        .filter(
            Scan.doctor_id == doctor.id,
            Scan.risk_level.in_([RiskLevel.high, RiskLevel.critical]),
            Scan.status != ScanStatus.reported,
        )
        .order_by(Scan.risk_level.desc(), Scan.scan_date.desc())
        .limit(10)
        .all()
    )
    result = []
    for scan in scans:
        patient = scan.patient
        result.append(
            UrgentCase(
                scan_id=scan.id,
                patient_id=scan.patient_id,
                patient_name=patient.full_name if patient else "Unknown",
                module=scan.module.value,
                risk_level=scan.risk_level.value if scan.risk_level else None,
                reason=scan.confidence_explanation,
                scan_date=scan.scan_date,
            )
        )
    return result


def _compute_upcoming_followups(db: Session, doctor: DoctorProfile) -> list[UpcomingFollowup]:
    today = date.today()
    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.id,
            Appointment.status == AppointmentStatus.scheduled,
            Appointment.scheduled_date >= today,
        )
        .order_by(Appointment.scheduled_date.asc())
        .limit(10)
        .all()
    )
    result = []
    for appt in appointments:
        patient = appt.patient
        result.append(
            UpcomingFollowup(
                appointment_id=appt.id,
                patient_id=appt.patient_id,
                patient_name=patient.full_name if patient else "Unknown",
                module=appt.appointment_type,
                scheduled_date=appt.scheduled_date,
                days_until=(appt.scheduled_date - today).days,
                status=appt.status.value,
            )
        )
    return result


def _compute_recent_scans(db: Session, doctor: DoctorProfile) -> list[RecentScan]:
    scans = (
        db.query(Scan)
        .filter(Scan.doctor_id == doctor.id)
        .order_by(Scan.created_at.desc())
        .limit(10)
        .all()
    )
    result = []
    for scan in scans:
        patient = scan.patient
        report = db.query(Report).filter(Report.scan_id == scan.id).first()
        result.append(
            RecentScan(
                scan_id=scan.id,
                patient_id=scan.patient_id,
                patient_name=patient.full_name if patient else "Unknown",
                module=scan.module.value,
                status=scan.status.value,
                risk_level=scan.risk_level.value if scan.risk_level else None,
                scan_date=scan.scan_date,
                report_id=report.id if report else None,
                rotterdam_positive=scan.rotterdam_positive,
            )
        )
    return result


@router.get("", response_model=DashboardSummary)
@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db), doctor: DoctorProfile = Depends(get_current_doctor_profile)
):
    return DashboardSummary(
        stats=_compute_stats(db, doctor),
        activity=_compute_activity(db, doctor),
        urgent_cases=_compute_urgent_cases(db, doctor),
        upcoming_followups=_compute_upcoming_followups(db, doctor),
        recent_scans=_compute_recent_scans(db, doctor),
    )


@router.get("/urgent-cases", response_model=list[UrgentCase])
def urgent_cases(
    db: Session = Depends(get_db), doctor: DoctorProfile = Depends(get_current_doctor_profile)
):
    return _compute_urgent_cases(db, doctor)

