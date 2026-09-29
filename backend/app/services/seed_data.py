"""
Comprehensive Seed Data Service for AuraMed.
Seeds realistic clinical dataset for test doctor Dr. Kavitha Mehta:
- 10 patients (P-2026-0001 to P-2026-0010) with realistic Indian demographics
- Varied risk levels (high, moderate, low) and multi-module screenings
- 2-3 scans per patient with completed analyses
- Digitally signed clinical reports for scans
- Upcoming follow-ups within 7 days & critical/urgent case
- Referrals to clinical specialists
- Corresponding audit log entries
"""
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.constants import (
    ANALYSIS_GENERATED,
    APPOINTMENT_SCHEDULED,
    NEW_PATIENT_REGISTERED,
    REFERRAL_CREATED,
    REPORT_CREATED,
    REPORT_SHARED,
    REPORT_SIGNED,
)
from app.core.security import hash_password
from app.models.appointment import Appointment
from app.models.audit_log import AuditLog
from app.models.doctor_profile import DoctorProfile
from app.models.enums import AppointmentStatus, ReferralPriority, ReportStatus, RiskLevel, ScanStatus, ScreeningModule, UserRole
from app.models.patient_profile import PatientProfile
from app.models.referral import Referral
from app.models.report import Report
from app.models.scan import Scan
from app.models.user import User
from app.services.audit import log_action


def seed_test_doctor_dataset(db: Session) -> dict:
    today = date.today()

    # 1. Get or Create Doctor Dr. Kavitha Mehta
    doc_user = db.query(User).filter(User.email == "doctor@auramed.com").first()
    if not doc_user:
        doc_user = User(
            email="doctor@auramed.com",
            password_hash=hash_password("123"),
            role=UserRole.doctor,
            is_active=True,
            is_verified=True,
        )
        db.add(doc_user)
        db.flush()

    doc_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doc_user.id).first()
    if not doc_profile:
        doc_profile = DoctorProfile(
            user_id=doc_user.id,
            full_name="Dr. Kavitha Mehta",
            registration_number="TNMC123456",
            specialty="Gynecologic Oncology",
            hospital="AuraMed General Hospital, Chennai",
            phone="+91-9000000001",
            address="Suite 402, Clinical Oncology & Diagnostic Wing, Chennai, Tamil Nadu 600006",
            is_approved=True,
            approved_at=datetime.now(timezone.utc),
        )
        db.add(doc_profile)
        db.flush()

    # 2. Patient Definitions (P-2026-0001 through P-2026-0010)
    patients_data = [
        {
            "code": "P-2026-0001",
            "name": "Anita Sharma",
            "dob": date(1984, 6, 12),
            "gender": "Female",
            "phone": "+91-98765-43210",
            "email": "anita.sharma@example.com",
            "address": "42 Green Glen Park, HSR Layout, Bengaluru, Karnataka 560102",
            "blood_group": "O+",
            "modules": ["breast", "cervical", "pcos"],
            "risk_level": RiskLevel.high,
            "is_urgent": True,
            "next_followup_days": 3,  # Within 7 days!
            "notes": "Multimodal screening: suspicious mass in right upper quadrant. Urgent biopsy advised.",
        },
        {
            "code": "P-2026-0002",
            "name": "Priya Nair",
            "dob": date(1990, 4, 18),
            "gender": "Female",
            "phone": "+91-98765-43211",
            "email": "priya.nair@example.com",
            "address": "18 Besant Avenue, Adyar, Chennai, Tamil Nadu 600020",
            "blood_group": "B+",
            "modules": ["breast", "cervical"],
            "risk_level": RiskLevel.moderate,
            "is_urgent": False,
            "next_followup_days": 5,  # Within 7 days!
            "notes": "Asymmetric glandular tissue observed. Follow-up diagnostic ultrasound scheduled.",
        },
        {
            "code": "P-2026-0003",
            "name": "Meera Iyer",
            "dob": date(1997, 8, 24),
            "gender": "Female",
            "phone": "+91-98765-43212",
            "email": "meera.iyer@example.com",
            "address": "104 Palm Meadows, Whitefield, Bengaluru, Karnataka 560066",
            "blood_group": "A+",
            "modules": ["pcos"],
            "risk_level": RiskLevel.low,
            "is_urgent": False,
            "next_followup_days": 60,
            "notes": "Mild bilateral ovarian stromal thickening. Metabolic lifestyle management plan initiated.",
        },
        {
            "code": "P-2026-0004",
            "name": "Sunita Verma",
            "dob": date(1975, 11, 30),
            "gender": "Female",
            "phone": "+91-98765-43213",
            "email": "sunita.verma@example.com",
            "address": "77 Anna Salai, Teynampet, Chennai, Tamil Nadu 600018",
            "blood_group": "AB+",
            "modules": ["breast"],
            "risk_level": RiskLevel.high,
            "is_urgent": True,
            "next_followup_days": 12,
            "notes": "Dense breast tissue with microcalcifications. Referred for stereotactic core biopsy.",
        },
        {
            "code": "P-2026-0005",
            "name": "Deepa Sundaram",
            "dob": date(1992, 3, 15),
            "gender": "Female",
            "phone": "+91-98765-43214",
            "email": "deepa.sundaram@example.com",
            "address": "12 Gandhi Road, Velachery, Chennai, Tamil Nadu 600042",
            "blood_group": "O-",
            "modules": ["cervical", "pcos"],
            "risk_level": RiskLevel.low,
            "is_urgent": False,
            "next_followup_days": 90,
            "notes": "Normal visual inspection with acetic acid. Routine annual follow-up.",
        },
        {
            "code": "P-2026-0006",
            "name": "Lakshmi Raman",
            "dob": date(1978, 9, 5),
            "gender": "Female",
            "phone": "+91-98765-43215",
            "email": "lakshmi.raman@example.com",
            "address": "33 Indiranagar 100ft Road, Bengaluru, Karnataka 560038",
            "blood_group": "B-",
            "modules": ["breast"],
            "risk_level": RiskLevel.moderate,
            "is_urgent": False,
            "next_followup_days": 21,
            "notes": "Benign fibroadenoma appearance. 6-month surveillance recommended.",
        },
        {
            "code": "P-2026-0007",
            "name": "Ritu Mathur",
            "dob": date(2000, 2, 19),
            "gender": "Female",
            "phone": "+91-98765-43216",
            "email": "ritu.mathur@example.com",
            "address": "89 Koramangala 4th Block, Bengaluru, Karnataka 560034",
            "blood_group": "A-",
            "modules": ["pcos"],
            "risk_level": RiskLevel.moderate,
            "is_urgent": False,
            "next_followup_days": 45,
            "notes": "Polycystic ovarian morphology noted with insulin resistance markers.",
        },
        {
            "code": "P-2026-0008",
            "name": "Kavita Krishnan",
            "dob": date(1971, 7, 22),
            "gender": "Female",
            "phone": "+91-98765-43217",
            "email": "kavita.krishnan@example.com",
            "address": "5 Poes Garden, Alwarpet, Chennai, Tamil Nadu 600086",
            "blood_group": "O+",
            "modules": ["breast", "cervical"],
            "risk_level": RiskLevel.low,
            "is_urgent": False,
            "next_followup_days": 180,
            "notes": "Clear dual screening. No malignant or dysplastic changes detected.",
        },
        {
            "code": "P-2026-0009",
            "name": "Sneha Kulkarni",
            "dob": date(1995, 12, 8),
            "gender": "Female",
            "phone": "+91-98765-43218",
            "email": "sneha.kulkarni@example.com",
            "address": "15 Malleshwaram 8th Cross, Bengaluru, Karnataka 560003",
            "blood_group": "B+",
            "modules": ["cervical"],
            "risk_level": RiskLevel.low,
            "is_urgent": False,
            "next_followup_days": 120,
            "notes": "Normal transformation zone and negative HPV cytology screening.",
        },
        {
            "code": "P-2026-0010",
            "name": "Shanthi Venkatesh",
            "dob": date(1964, 5, 14),
            "gender": "Female",
            "phone": "+91-98765-43219",
            "email": "shanthi.venkatesh@example.com",
            "address": "29 Harrington Road, Chetpet, Chennai, Tamil Nadu 600031",
            "blood_group": "AB-",
            "modules": ["breast"],
            "risk_level": RiskLevel.high,
            "is_urgent": True,
            "next_followup_days": 10,
            "notes": "Architectural distortion in left upper outer quadrant with axillary lymph node prominence.",
        },
    ]

    created_patients = 0
    created_scans = 0
    created_reports = 0
    created_appts = 0

    for p_info in patients_data:
        # Check if patient already exists
        pat_profile = db.query(PatientProfile).filter(PatientProfile.patient_code == p_info["code"]).first()
        if not pat_profile:
            # Create user for patient
            pat_user = db.query(User).filter(User.email == p_info["email"]).first()
            if not pat_user:
                pat_user = User(
                    email=p_info["email"],
                    password_hash=hash_password("123"),
                    role=UserRole.patient,
                    is_active=True,
                    is_verified=True,
                )
                db.add(pat_user)
                db.flush()

            pat_profile = PatientProfile(
                user_id=pat_user.id,
                patient_code=p_info["code"],
                full_name=p_info["name"],
                date_of_birth=p_info["dob"],
                gender=p_info["gender"],
                phone=p_info["phone"],
                address=p_info["address"],
                blood_group=p_info["blood_group"],
                status="active",
                is_urgent=p_info["is_urgent"],
                overall_notes=p_info["notes"],
                created_by_doctor_id=doc_profile.id,
                preferred_modules=p_info["modules"],
                consent={"email_notifications": True, "appointment_reminders": True},
            )
            db.add(pat_profile)
            db.flush()
            created_patients += 1

            # Log patient registered
            log_action(
                db,
                user_id=doc_profile.user_id,
                user_type="doctor",
                action=NEW_PATIENT_REGISTERED,
                resource_type="patient_profile",
                resource_id=pat_profile.id,
                details={"patient_code": p_info["code"], "full_name": p_info["name"]},
            )
        else:
            pat_profile.full_name = p_info["name"]
            pat_profile.date_of_birth = p_info["dob"]
            pat_profile.gender = p_info["gender"]
            pat_profile.phone = p_info["phone"]
            pat_profile.address = p_info["address"]
            pat_profile.blood_group = p_info["blood_group"]
            pat_profile.is_urgent = p_info["is_urgent"]
            pat_profile.overall_notes = p_info["notes"]
            pat_profile.preferred_modules = p_info["modules"]
            db.flush()

        # 3. Create 2-3 Scans across modules for each patient
        for m_str in p_info["modules"]:
            mod_enum = ScreeningModule(m_str) if m_str in [e.value for e in ScreeningModule] else ScreeningModule.breast
            scan = db.query(Scan).filter(
                Scan.patient_id == pat_profile.id,
                Scan.module == mod_enum,
            ).first()

            if not scan:
                scan = Scan(
                    patient_id=pat_profile.id,
                    doctor_id=doc_profile.id,
                    module=mod_enum,
                    scan_date=today - timedelta(days=15),
                    status=ScanStatus.reported,
                    risk_level=p_info["risk_level"],
                    image_path=f"uploads/scans/{p_info['code']}_{m_str}.png",
                    file_name=f"{p_info['code']}_{m_str}.png",
                    file_size=245800,
                    clinical_inputs={
                        "patient_age": 2026 - p_info["dob"].year,
                        "symptoms": p_info["notes"][:60],
                        "examination_date": (today - timedelta(days=15)).strftime("%Y-%m-%d"),
                    },
                    fusion_score=0.88 if p_info["risk_level"] == RiskLevel.high else (0.52 if p_info["risk_level"] == RiskLevel.moderate else 0.14),
                    confidence_score=0.94,
                    reasoning={
                        "classification": p_info["risk_level"].value.title(),
                        "ai_findings": [f"AI observation for {m_str}: verified clinical markers match {p_info['risk_level'].value} profile."],
                    },
                    ai_suggestions={
                        "suggested_action": "Biopsy" if p_info["risk_level"] == RiskLevel.high else "Surveillance",
                    },
                )
                db.add(scan)
                db.flush()
                created_scans += 1

                log_action(
                    db,
                    user_id=doc_profile.user_id,
                    user_type="doctor",
                    action=ANALYSIS_GENERATED,
                    resource_type="scan",
                    resource_id=scan.id,
                    details={"module": m_str, "risk_level": p_info["risk_level"].value},
                )
            else:
                scan.risk_level = p_info["risk_level"]
                db.flush()

            # 4. Ensure signed Report for this scan exists
            existing_rep = db.query(Report).filter(Report.scan_id == scan.id).first()
            if not existing_rep:
                rep_num = f"RPT-2026-{str(scan.id)[:4].upper()}"
                rep = Report(
                    report_number=rep_num,
                    scan_id=scan.id,
                    patient_id=pat_profile.id,
                    doctor_id=doc_profile.id,
                    status=ReportStatus.signed,
                    signed_at=datetime.now(timezone.utc) - timedelta(days=1),
                    signed_by=doc_profile.id,
                    shared_with_patient=True,
                    shared_at=datetime.now(timezone.utc) - timedelta(hours=12),
                    content={
                        "patient_information": {
                            "name": p_info["name"],
                            "patient_id": p_info["code"],
                            "age": 2026 - p_info["dob"].year,
                            "gender": p_info["gender"],
                            "report_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
                        },
                        "clinical_summary": {
                            "symptoms": p_info["notes"],
                            "module": m_str.title(),
                            "history": "Electronic health record on AuraMed platform.",
                        },
                        "imaging_findings": {
                            "observations": f"Detailed high-resolution {m_str} clinical review completed.",
                            "density": "Category B - Scattered fibroglandular densities",
                            "lesion_detected": p_info["risk_level"] == RiskLevel.high,
                        },
                        "ai_and_clinical_assessment": {
                            "risk_category": p_info["risk_level"].value.title(),
                            "concordance": "High agreement between multimodal AI inference and clinician observation.",
                        },
                        "risk_assessment": {
                            "level": p_info["risk_level"].value,
                            "score_pct": 88 if p_info["risk_level"] == RiskLevel.high else (52 if p_info["risk_level"] == RiskLevel.moderate else 14),
                        },
                        "recommendations": {
                            "plan": f"Next screening consultation scheduled in {p_info['next_followup_days']} days.",
                            "lifestyle_modifications": "Maintain balanced Mediterranean diet and regular cardiovascular exercise.",
                        },
                    },
                )
                db.add(rep)
                db.flush()
                created_reports += 1

                log_action(
                    db,
                    user_id=doc_profile.user_id,
                    user_type="doctor",
                    action=REPORT_SIGNED,
                    resource_type="report",
                    resource_id=rep.id,
                    details={"report_number": rep_num},
                )

        # Ensure any pre-existing scans for this patient also have signed reports
        all_pat_scans = db.query(Scan).filter(Scan.patient_id == pat_profile.id).all()
        for sc in all_pat_scans:
            if not db.query(Report).filter(Report.scan_id == sc.id).first():
                rep_num = f"RPT-2026-{str(sc.id)[:4].upper()}"
                rep = Report(
                    report_number=rep_num,
                    scan_id=sc.id,
                    patient_id=pat_profile.id,
                    doctor_id=doc_profile.id,
                    status=ReportStatus.signed,
                    signed_at=datetime.now(timezone.utc) - timedelta(days=1),
                    signed_by=doc_profile.id,
                    shared_with_patient=True,
                    shared_at=datetime.now(timezone.utc) - timedelta(hours=12),
                    content={
                        "patient_information": {
                            "name": p_info["name"],
                            "patient_id": p_info["code"],
                            "age": 2026 - p_info["dob"].year,
                            "gender": p_info["gender"],
                            "report_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
                        },
                        "clinical_summary": {
                            "symptoms": p_info["notes"],
                            "module": sc.module.value.title() if sc.module else "Screening",
                            "history": "Electronic health record on AuraMed platform.",
                        },
                        "imaging_findings": {
                            "observations": "Detailed high-resolution clinical review completed.",
                            "density": "Category B - Scattered fibroglandular densities",
                            "lesion_detected": sc.risk_level == RiskLevel.high,
                        },
                        "ai_and_clinical_assessment": {
                            "risk_category": (sc.risk_level.value if sc.risk_level else "low").title(),
                            "concordance": "High agreement between multimodal AI inference and clinician observation.",
                        },
                        "risk_assessment": {
                            "level": sc.risk_level.value if sc.risk_level else "low",
                            "score_pct": 88 if sc.risk_level == RiskLevel.high else (52 if sc.risk_level == RiskLevel.moderate else 14),
                        },
                        "recommendations": {
                            "plan": f"Next screening consultation scheduled.",
                            "lifestyle_modifications": "Maintain balanced diet and regular exercise.",
                        },
                    },
                )
                db.add(rep)
                db.flush()
                created_reports += 1

        # 5. Create Appointments for patient
        # Create upcoming follow-up appointment
        followup_date = today + timedelta(days=p_info["next_followup_days"])
        existing_appt = db.query(Appointment).filter(
            Appointment.patient_id == pat_profile.id,
            Appointment.scheduled_date == followup_date,
        ).first()

        if not existing_appt:
            appt = Appointment(
                patient_id=pat_profile.id,
                doctor_id=doc_profile.id,
                scheduled_date=followup_date,
                scheduled_time=time(10, 30),
                location="AuraMed Clinical Consultation Room A, Chennai",
                appointment_type="Urgent Review" if p_info["is_urgent"] else "Clinical Follow-up",
                status=AppointmentStatus.scheduled,
                notes=p_info["notes"],
                ai_recommended=True,
            )
            db.add(appt)
            db.flush()
            created_appts += 1

            log_action(
                db,
                user_id=doc_profile.user_id,
                user_type="doctor",
                action=APPOINTMENT_SCHEDULED,
                resource_type="appointment",
                resource_id=appt.id,
                details={"scheduled_date": str(followup_date), "is_urgent": p_info["is_urgent"]},
            )

        # Create past completed appointment
        past_date = today - timedelta(days=15)
        existing_past = db.query(Appointment).filter(
            Appointment.patient_id == pat_profile.id,
            Appointment.scheduled_date == past_date,
        ).first()
        if not existing_past:
            past_appt = Appointment(
                patient_id=pat_profile.id,
                doctor_id=doc_profile.id,
                scheduled_date=past_date,
                scheduled_time=time(11, 0),
                location="AuraMed Imaging Center, Chennai",
                appointment_type="Initial Diagnostic Screening",
                status=AppointmentStatus.completed,
                notes="Baseline scans performed and completed.",
                ai_recommended=False,
            )
            db.add(past_appt)
            created_appts += 1

    # 6. Create 2-3 Referrals
    referral_targets = [
        ("Dr. Rajesh Raman", "Apollo Speciality Cancer Center", "Surgical Oncology", ReferralPriority.urgent),
        ("Dr. Ananya Sen", "AuraMed Advanced Imaging", "Diagnostic Radiology", ReferralPriority.routine),
        ("Dr. Arvind Menon", "Metro Fertility Institute", "Endocrinology & Reproductive Health", ReferralPriority.routine),
    ]

    p1 = db.query(PatientProfile).filter(PatientProfile.patient_code == "P-2026-0001").first()
    p4 = db.query(PatientProfile).filter(PatientProfile.patient_code == "P-2026-0004").first()
    p3 = db.query(PatientProfile).filter(PatientProfile.patient_code == "P-2026-0003").first()

    ref_patients = [p1, p4, p3]
    created_refs = 0

    for i, (spec_name, hosp, spec_field, prio) in enumerate(referral_targets):
        pat = ref_patients[i] if i < len(ref_patients) and ref_patients[i] else p1
        if pat:
            existing_ref = db.query(Referral).filter(
                Referral.patient_id == pat.id,
                Referral.from_doctor_id == doc_profile.id,
                Referral.to_specialist == spec_name,
            ).first()

            if not existing_ref:
                ref = Referral(
                    patient_id=pat.id,
                    from_doctor_id=doc_profile.id,
                    to_specialist=spec_name,
                    specialty=spec_field,
                    priority=prio,
                    status="scheduled" if i == 0 else "accepted",
                    reason=f"Specialist second opinion for {pat.full_name}.",
                    notes="Complete multimodal scan package and clinical report attached.",
                )
                db.add(ref)
                db.flush()
                created_refs += 1

                log_action(
                    db,
                    user_id=doc_profile.user_id,
                    user_type="doctor",
                    action=REFERRAL_CREATED,
                    resource_type="referral",
                    resource_id=ref.id,
                    details={"specialist": spec_name, "priority": prio.value},
                )

    db.commit()

    return {
        "status": "success",
        "created_patients": created_patients,
        "created_scans": created_scans,
        "created_reports": created_reports,
        "created_appointments": created_appts,
        "created_referrals": created_refs,
    }
