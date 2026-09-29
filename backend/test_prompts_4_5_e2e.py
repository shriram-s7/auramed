"""
End-to-End Verification Script for Prompt 4 and Prompt 5
Tests all requirements across doctor, patient, and admin portals including:
- Data isolation (403 Forbidden on cross-user access)
- Real database querying (no mock data)
- Appointment CRUD
- Scan submission and results retrieval
- Report draft -> approval -> share with patient
- Patient-safe report retrieval (no raw AI scores)
- Admin cross-system visibility and cancellation
"""
import sys
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_tests():
    print("=" * 70)
    print("STARTING E2E INTEGRATION TEST SUITE (PROMPTS 4 & 5)")
    print("=" * 70)

    # -------------------------------------------------------------
    # STEP 1: Login as testdr1
    # -------------------------------------------------------------
    print("\n[STEP 1] Login as testdr1...")
    res = client.post("/api/auth/login", json={"email": "testdr1@auramed.com", "password": "Doctor@123"})
    assert res.status_code == 200, f"Doctor login failed: {res.text}"
    dr1_token = res.json()["access_token"]
    dr1_headers = {"Authorization": f"Bearer {dr1_token}"}
    print("  [OK] Logged in as testdr1 (role: doctor)")

    # Get testpatient1 ID
    pats_res = client.get("/api/doctor/patients", headers=dr1_headers)
    assert pats_res.status_code == 200, f"Failed to get patients: {pats_res.text}"
    pats_list = pats_res.json().get("items", [])
    testpatient1 = next((p for p in pats_list if "Priya" in p["full_name"] or "testpatient1" in p.get("email", "")), pats_list[0] if pats_list else None)
    assert testpatient1 is not None, "testpatient1 not found in doctor's patients"
    patient1_id = testpatient1["id"]
    print(f"  [OK] Found patient: {testpatient1['full_name']} (id: {patient1_id})")

    # -------------------------------------------------------------
    # STEP 2: Create appointment for testpatient1 (breast screening)
    # -------------------------------------------------------------
    import time
    from datetime import date, timedelta
    appt_date = (date.today() + timedelta(days=30 + (int(time.time()) % 200))).isoformat()
    print(f"\n[STEP 2] Create appointment for testpatient1 on {appt_date}...")
    appt_payload = {
        "patient_id": patient1_id,
        "type": "breast_screening",
        "date": appt_date,
        "time": "10:30",
        "notes": "E2E verification appointment breast screening"
    }
    create_appt_res = client.post("/api/doctor/appointments", headers=dr1_headers, json=appt_payload)
    assert create_appt_res.status_code == 201, f"Failed to create appointment: {create_appt_res.text}"
    appt_data = create_appt_res.json()
    appt_id = appt_data["id"]
    print(f"  [OK] Appointment created: {appt_id} (type: {appt_data.get('type') or appt_data.get('appointment_type')}, status: {appt_data.get('status')})")

    # Doctor list appointments - verify it's there
    dr_appts_res = client.get("/api/doctor/appointments", headers=dr1_headers).json()
    dr_appts = dr_appts_res.get("items", []) if isinstance(dr_appts_res, dict) else dr_appts_res
    assert any(a["id"] == appt_id for a in dr_appts), f"Created appointment {appt_id} not in doctor's list: {dr_appts}"
    print("  [OK] Verified appointment appears in doctor's appointment list")

    # -------------------------------------------------------------
    # STEP 3: Submit a breast scan for testpatient1
    # -------------------------------------------------------------
    print("\n[STEP 3] Submit breast scan for testpatient1...")
    scan_payload = {
        "patient_id": patient1_id,
        "clinical_inputs": {
            "age": 45,
            "menopause_status": "premenopausal",
            "family_history_breast_cancer": "none",
            "prior_benign_biopsy": "no",
            "density_category": "scattered_fibroglandular",
            "palpable_lump": "no",
            "lump_size_cm": 0.0
        }
    }
    scan_res = client.post("/api/doctor/scan/breast", headers=dr1_headers, json=scan_payload)
    assert scan_res.status_code == 201, f"Failed to submit breast scan: {scan_res.text}"
    scan_data = scan_res.json()
    scan_id = scan_data["scan_id"]
    print(f"  [OK] Scan submitted: {scan_id} (risk: {scan_data.get('risk_level')})")

    # -------------------------------------------------------------
    # STEP 4: View the results page
    # -------------------------------------------------------------
    print(f"\n[STEP 4] View results page for scan {scan_id}...")
    results_res = client.get(f"/api/doctor/scan/results/{scan_id}", headers=dr1_headers)
    assert results_res.status_code == 200, f"Failed to get scan results: {results_res.text}"
    results_data = results_res.json()
    assert "risk_level" in results_data, "risk_level missing from results"
    print(f"  [OK] Scan results retrieved: module={results_data.get('module')}, risk={results_data.get('risk_level')}")

    # -------------------------------------------------------------
    # STEP 5: Generate and approve the report
    # -------------------------------------------------------------
    print("\n[STEP 5] Generate and approve the report...")
    rep_create = client.post("/api/doctor/reports", headers=dr1_headers, json={"scan_id": scan_id})
    assert rep_create.status_code == 201, f"Failed to create report: {rep_create.text}"
    report_id = rep_create.json()["id"]
    print(f"  [OK] Report created: {report_id} (status: {rep_create.json().get('status')})")

    rep_approve = client.post(f"/api/doctor/reports/{report_id}/approve", headers=dr1_headers)
    assert rep_approve.status_code == 200, f"Failed to approve report: {rep_approve.text}"
    print(f"  [OK] Report approved: status={rep_approve.json().get('status')}")

    # -------------------------------------------------------------
    # STEP 6: Share report with patient
    # -------------------------------------------------------------
    print(f"\n[STEP 6] Share report {report_id} with patient...")
    share_res = client.post(
        f"/api/doctor/reports/{report_id}/share",
        headers=dr1_headers,
        json={"share_with_patient": True, "delivery_method": "portal"}
    )
    assert share_res.status_code == 200, f"Failed to share report: {share_res.text}"
    print(f"  [OK] Report shared: status={share_res.json().get('status')}")

    # -------------------------------------------------------------
    # STEP 7: Login as testpatient1
    # -------------------------------------------------------------
    print("\n[STEP 7] Login as testpatient1...")
    p1_login = client.post("/api/auth/login", json={"email": "testpatient1@auramed.com", "password": "Patient@123"})
    assert p1_login.status_code == 200, f"Patient1 login failed: {p1_login.text}"
    p1_token = p1_login.json()["access_token"]
    p1_headers = {"Authorization": f"Bearer {p1_token}"}
    print("  [OK] Logged in as testpatient1 (role: patient)")

    # -------------------------------------------------------------
    # STEP 8: See appointment in patient portal
    # -------------------------------------------------------------
    print("\n[STEP 8] Check appointments in patient portal...")
    # Both /api/patient/appointments and /api/patients/me/appointments
    p_appts1 = client.get("/api/patient/appointments", headers=p1_headers)
    assert p_appts1.status_code == 200, f"Failed to get /api/patient/appointments: {p_appts1.text}"
    p_appts_data = p_appts1.json()
    if isinstance(p_appts_data, dict):
        all_p_appts = p_appts_data.get("items") or (p_appts_data.get("upcoming_list", []) + p_appts_data.get("past", []))
    else:
        all_p_appts = p_appts_data
    found_appt = any(str(a.get("id")) == str(appt_id) for a in all_p_appts)
    assert found_appt, f"Appointment {appt_id} not found in patient appointments list: {all_p_appts}"
    print(f"  [OK] Appointment verified in /api/patient/appointments")

    # -------------------------------------------------------------
    # STEP 9: See shared report in patient portal (patient-safe summary)
    # -------------------------------------------------------------
    print("\n[STEP 9] Check shared report in patient portal...")
    p_reps = client.get("/api/patient/reports", headers=p1_headers)
    assert p_reps.status_code == 200, f"Failed to get /api/patient/reports: {p_reps.text}"
    p_reps_list = p_reps.json()
    assert any(str(r.get("id")) == str(report_id) for r in p_reps_list), f"Shared report {report_id} not in /api/patient/reports"
    print(f"  [OK] Report {report_id} appears in /api/patient/reports list")

    p_rep_detail = client.get(f"/api/patient/reports/{report_id}", headers=p1_headers)
    assert p_rep_detail.status_code == 200, f"Failed to get report detail: {p_rep_detail.text}"
    detail_data = p_rep_detail.json()
    # Confirm patient-safe (no raw ai_score or fusion_score)
    assert "ai_score" not in detail_data or detail_data["ai_score"] is None, "Raw AI score leaked to patient!"
    assert "fusion_score" not in detail_data or detail_data["fusion_score"] is None, "Raw fusion score leaked to patient!"
    print(f"  [OK] Report detail is patient-safe (no raw AI scores leaked)")

    # -------------------------------------------------------------
    # STEP 10: Confirm testpatient2 cannot see testpatient1's report (403)
    # -------------------------------------------------------------
    print("\n[STEP 10] Confirm testpatient2 cannot see testpatient1's report (403 Forbidden)...")
    p2_login = client.post("/api/auth/login", json={"email": "testpatient2@auramed.com", "password": "Patient@123"})
    assert p2_login.status_code == 200, f"Patient2 login failed: {p2_login.text}"
    p2_token = p2_login.json()["access_token"]
    p2_headers = {"Authorization": f"Bearer {p2_token}"}

    p2_rep_check = client.get(f"/api/patient/reports/{report_id}", headers=p2_headers)
    assert p2_rep_check.status_code == 403, f"Expected 403 Forbidden for patient2, got {p2_rep_check.status_code}: {p2_rep_check.text}"
    print(f"  [OK] testpatient2 correctly received HTTP 403 Forbidden when accessing testpatient1's report")

    # Also test /api/patients/me/reports/{id}
    p2_rep_check_me = client.get(f"/api/patients/me/reports/{report_id}", headers=p2_headers)
    assert p2_rep_check_me.status_code == 403, f"Expected 403 Forbidden on /api/patients/me/reports/{{id}}, got {p2_rep_check_me.status_code}"
    print(f"  [OK] testpatient2 correctly received HTTP 403 Forbidden on /api/patients/me/reports/{report_id}")

    # -------------------------------------------------------------
    # STEP 10b: Confirm doctor data isolation (Prompt 4 Step 5: testdr2 cannot see/edit testdr1's appointment or scan)
    # -------------------------------------------------------------
    print("\n[STEP 10b] Confirm doctor data isolation (testdr2 cannot access testdr1's appointment or scan)...")
    dr2_login = client.post("/api/auth/login", json={"email": "testdr2@auramed.com", "password": "Doctor@123"})
    assert dr2_login.status_code == 200, f"Doctor2 login failed: {dr2_login.text}"
    dr2_token = dr2_login.json()["access_token"]
    dr2_headers = {"Authorization": f"Bearer {dr2_token}"}

    # Dr2 attempts to fetch Dr1's appointment by ID -> 403
    dr2_appt_get = client.get(f"/api/doctor/appointments/{appt_id}", headers=dr2_headers)
    assert dr2_appt_get.status_code == 403, f"Expected 403 Forbidden for dr2 accessing dr1's appt, got {dr2_appt_get.status_code}: {dr2_appt_get.text}"
    print(f"  [OK] testdr2 GET /api/doctor/appointments/{appt_id} returned HTTP 403 Forbidden")

    # Dr2 attempts to modify Dr1's appointment -> 403
    dr2_appt_put = client.put(f"/api/doctor/appointments/{appt_id}", headers=dr2_headers, json={"notes": "Hacked"})
    assert dr2_appt_put.status_code == 403, f"Expected 403 Forbidden for dr2 editing dr1's appt, got {dr2_appt_put.status_code}"
    print(f"  [OK] testdr2 PUT /api/doctor/appointments/{appt_id} returned HTTP 403 Forbidden")

    # Dr2 attempts to cancel Dr1's appointment -> 403
    dr2_appt_del = client.delete(f"/api/doctor/appointments/{appt_id}", headers=dr2_headers)
    assert dr2_appt_del.status_code == 403, f"Expected 403 Forbidden for dr2 deleting dr1's appt, got {dr2_appt_del.status_code}"
    print(f"  [OK] testdr2 DELETE /api/doctor/appointments/{appt_id} returned HTTP 403 Forbidden")

    # Dr2 attempts to view Dr1's scan results -> 403
    dr2_scan_get = client.get(f"/api/doctor/scan/results/{scan_id}", headers=dr2_headers)
    assert dr2_scan_get.status_code == 403, f"Expected 403 Forbidden for dr2 accessing dr1's scan, got {dr2_scan_get.status_code}"
    print(f"  [OK] testdr2 GET /api/doctor/scan/results/{scan_id} returned HTTP 403 Forbidden")

    # -------------------------------------------------------------
    # STEP 11: Login as testadmin1
    # -------------------------------------------------------------
    print("\n[STEP 11] Login as testadmin1...")
    admin_login = client.post("/api/auth/login", json={"email": "testadmin1@auramed.com", "password": "Admin@123"})
    assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("  [OK] Logged in as testadmin1 (role: admin)")

    # -------------------------------------------------------------
    # STEP 12: Confirm all data visible in admin portal
    # -------------------------------------------------------------
    print("\n[STEP 12] Confirm all data visible in admin portal...")
    # 1. Admin scans (includes raw scores)
    a_scans = client.get("/api/admin/scans", headers=admin_headers)
    assert a_scans.status_code == 200, f"Failed to get admin scans: {a_scans.text}"
    a_scans_list = a_scans.json().get("items", []) if isinstance(a_scans.json(), dict) else a_scans.json()
    assert any(str(s.get("id")) == str(scan_id) for s in a_scans_list), f"Scan {scan_id} not in admin scans"
    print(f"  [OK] Admin sees scan {scan_id} in system-wide scans")

    # 2. Admin reports
    a_reps = client.get("/api/admin/reports", headers=admin_headers)
    assert a_reps.status_code == 200, f"Failed to get admin reports: {a_reps.text}"
    a_reps_list = a_reps.json().get("items", []) if isinstance(a_reps.json(), dict) else a_reps.json()
    assert any(str(r.get("id")) == str(report_id) for r in a_reps_list), f"Report {report_id} not in admin reports"
    print(f"  [OK] Admin sees report {report_id} in system-wide reports")

    # 3. Admin appointments
    a_appts = client.get("/api/admin/appointments", headers=admin_headers)
    assert a_appts.status_code == 200, f"Failed to get admin appointments: {a_appts.text}"
    a_appts_list = a_appts.json().get("items", []) if isinstance(a_appts.json(), dict) else a_appts.json()
    assert any(str(a.get("id")) == str(appt_id) for a in a_appts_list), f"Appointment {appt_id} not in admin appointments"
    print(f"  [OK] Admin sees appointment {appt_id} in system-wide appointments")

    # 4. Admin dashboard
    a_dash = client.get("/api/admin/dashboard", headers=admin_headers)
    assert a_dash.status_code == 200, f"Failed to get admin dashboard: {a_dash.text}"
    print("  [OK] Admin dashboard stats live query succeeded")

    # 5. Admin can cancel any appointment
    a_del_appt = client.delete(f"/api/admin/appointments/{appt_id}", headers=admin_headers)
    assert a_del_appt.status_code == 200, f"Admin failed to cancel appointment: {a_del_appt.text}"
    print(f"  [OK] Admin successfully cancelled appointment {appt_id}")

    # -------------------------------------------------------------
    # LIVE DASHBOARD STATS VERIFICATION
    # -------------------------------------------------------------
    print("\n[VERIFICATION] Live Doctor and Patient Dashboard Stats...")
    # Doctor dashboard stats
    doc_dash = client.get("/api/doctor/dashboard", headers=dr1_headers)
    assert doc_dash.status_code == 200, f"Doctor dashboard failed: {doc_dash.text}"
    doc_dash_data = doc_dash.json()
    assert "stats" in doc_dash_data, "Doctor dashboard missing stats"
    print(f"  [OK] Doctor dashboard: total_patients={doc_dash_data['stats'].get('total_patients')}, total_scans={doc_dash_data['stats'].get('total_scans')}, total_reports={doc_dash_data['stats'].get('total_reports')}")

    # Patient dashboard stats
    pat_dash = client.get("/api/patient/dashboard", headers=p1_headers)
    assert pat_dash.status_code == 200, f"Patient dashboard failed: {pat_dash.text}"
    pat_dash_data = pat_dash.json()
    assert "total_reports" in pat_dash_data, "Patient dashboard missing total_reports"
    print(f"  [OK] Patient dashboard: total_reports={pat_dash_data.get('total_reports')}, last_scan_date={pat_dash_data.get('last_scan_date')}")

    print("\n" + "=" * 70)
    print("ALL 12+ STEPS IN PROMPT 4 & PROMPT 5 INTEGRATION SUITE PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
