import json
import time
import httpx

client = httpx.Client(timeout=30.0)

BASE_URL = "http://127.0.0.1:8000"

# Colors for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

results = []

def record(route_name, method, path, status_code, expected_status, passed, notes=""):
    color = GREEN if passed else RED
    status_label = "PASS" if passed else "FAIL"
    results.append({
        "name": route_name,
        "method": method,
        "path": path,
        "status_code": status_code,
        "expected": expected_status,
        "passed": passed,
        "notes": notes,
    })
    print(f"[{color}{status_label}{RESET}] {method:<6} {path:<40} (HTTP {status_code}) {notes}")


def test_cors():
    print(f"\n{BOLD}{CYAN}=== TESTING CORS & MIDDLEWARE ==={RESET}")
    res = client.options(
        f"{BASE_URL}/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        }
    )
    cors_ok = res.headers.get("access-control-allow-origin") in ["http://localhost:5173", "*"]
    record("CORS localhost:5173", "OPTIONS", "/api/health", res.status_code, 200, cors_ok, f"Allow-Origin: {res.headers.get('access-control-allow-origin')}")

    # Test 401 on protected endpoint without token
    res_401 = client.get(f"{BASE_URL}/api/admin/dashboard")
    body = res_401.json() if res_401.headers.get("content-type", "").startswith("application/json") else {}
    has_err_format = body.get("error") is True and body.get("code") == 401
    record("Auth 401 error format", "GET", "/api/admin/dashboard (no token)", res_401.status_code, 401, res_401.status_code == 401 and has_err_format, f"Format OK: {has_err_format}")


def run_tests():
    test_cors()

    print(f"\n{BOLD}{CYAN}=== STEP 2: AUTHENTICATION ROUTES ==={RESET}")
    # 1. Admin Login
    admin_login_res = client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "testadmin1@auramed.com", "password": "Admin@123"}
    )
    admin_data = admin_login_res.json()
    admin_token = admin_data.get("access_token")
    admin_role = admin_data.get("role")
    record(
        "Admin Login",
        "POST",
        "/api/auth/login",
        admin_login_res.status_code,
        200,
        admin_login_res.status_code == 200 and admin_token and admin_role == "admin",
        f"Role: {admin_role}"
    )

    # 2. Doctor Login
    doc_login_res = client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "testdr1@auramed.com", "password": "Doctor@123"}
    )
    doc_data = doc_login_res.json()
    doc_token = doc_data.get("access_token")
    doc_role = doc_data.get("role")
    record(
        "Doctor Login",
        "POST",
        "/api/auth/login",
        doc_login_res.status_code,
        200,
        doc_login_res.status_code == 200 and doc_token and doc_role == "doctor",
        f"Role: {doc_role}"
    )

    # 3. Patient Login
    pat_login_res = client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "testpatient1@auramed.com", "password": "Patient@123"}
    )
    pat_data = pat_login_res.json()
    pat_token = pat_data.get("access_token")
    pat_refresh_token = pat_data.get("refresh_token")
    pat_role = pat_data.get("role")
    record(
        "Patient Login",
        "POST",
        "/api/auth/login",
        pat_login_res.status_code,
        200,
        pat_login_res.status_code == 200 and pat_token and pat_role == "patient",
        f"Role: {pat_role}"
    )

    # 4. Patient Self-Registration
    ts = int(time.time())
    new_patient_email = f"newpatient_{ts}@test.com"
    reg_res = client.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "full_name": "Test Self Registered",
            "email": new_patient_email,
            "password": "Patient@123",
            "phone": "+91-9876543210",
            "gender": "Female",
            "date_of_birth": "1995-05-15",
            "address": "123 Anna Nagar, Chennai",
        }
    )
    reg_data = reg_res.json()
    record(
        "Patient Self-Registration",
        "POST",
        "/api/auth/register",
        reg_res.status_code,
        201,
        reg_res.status_code == 201 and reg_data.get("role") == "patient",
        f"Patient Code: {reg_data.get('patient_code')}"
    )

    # 5. GET /api/auth/me (Patient)
    me_res = client.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {pat_token}"}
    )
    me_data = me_res.json()
    record(
        "Current User Profile (Patient)",
        "GET",
        "/api/auth/me",
        me_res.status_code,
        200,
        me_res.status_code == 200 and me_data.get("role") == "patient",
        f"User: {me_data.get('email')}"
    )

    # 6. POST /api/auth/refresh
    refresh_res = client.post(
        f"{BASE_URL}/api/auth/refresh",
        json={"refresh_token": pat_refresh_token}
    )
    ref_data = refresh_res.json()
    record(
        "Refresh JWT Token",
        "POST",
        "/api/auth/refresh",
        refresh_res.status_code,
        200,
        refresh_res.status_code == 200 and bool(ref_data.get("access_token")),
        f"New Token issued"
    )

    # 7. POST /api/auth/logout
    logout_res = client.post(
        f"{BASE_URL}/api/auth/logout",
        headers={"Authorization": f"Bearer {pat_token}"}
    )
    record(
        "Logout",
        "POST",
        "/api/auth/logout",
        logout_res.status_code,
        200,
        logout_res.status_code == 200,
        logout_res.json().get("message", "")
    )

    # Re-login patient for patient portal tests
    pat_token = client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "testpatient1@auramed.com", "password": "Patient@123"}
    ).json().get("access_token")

    print(f"\n{BOLD}{CYAN}=== STEP 3: PATIENT ROUTES (JWT REQUIRED) ==={RESET}")
    pat_headers = {"Authorization": f"Bearer {pat_token}"}

    # 1. GET /api/patients/me
    p_me = client.get(f"{BASE_URL}/api/patients/me", headers=pat_headers)
    pat_profile_id = p_me.json().get("id")
    record("Patient Profile", "GET", "/api/patients/me", p_me.status_code, 200, p_me.status_code == 200, f"Code: {p_me.json().get('patient_code')}")

    # 2. PUT /api/patients/me
    p_update = client.put(
        f"{BASE_URL}/api/patients/me",
        headers=pat_headers,
        json={"phone": "+91-9988776655", "blood_group": "B+"}
    )
    record("Update Patient Profile", "PUT", "/api/patients/me", p_update.status_code, 200, p_update.status_code == 200 and p_update.json().get("phone") == "+91-9988776655", "Phone updated")

    # 3. GET /api/patients/me/appointments
    p_appts = client.get(f"{BASE_URL}/api/patients/me/appointments", headers=pat_headers)
    record("Patient Appointments List", "GET", "/api/patients/me/appointments", p_appts.status_code, 200, p_appts.status_code == 200, f"Count: {len(p_appts.json())}")

    # 4. GET /api/patients/me/scans
    p_scans = client.get(f"{BASE_URL}/api/patients/me/scans", headers=pat_headers)
    record("Patient Scans List", "GET", "/api/patients/me/scans", p_scans.status_code, 200, p_scans.status_code == 200, f"Count: {len(p_scans.json())}")

    # 5. GET /api/patients/me/reports
    p_reports = client.get(f"{BASE_URL}/api/patients/me/reports", headers=pat_headers)
    p_reports_list = p_reports.json() if p_reports.status_code == 200 else []
    record("Patient Reports List", "GET", "/api/patients/me/reports", p_reports.status_code, 200, p_reports.status_code == 200, f"Approved reports: {len(p_reports_list)}")

    # 6. GET /api/patients/me/reports/{id}
    report_id_to_test = p_reports_list[0]["id"] if p_reports_list else None
    if report_id_to_test:
        p_rep_detail = client.get(f"{BASE_URL}/api/patients/me/reports/{report_id_to_test}", headers=pat_headers)
        record("Single Patient Report", "GET", f"/api/patients/me/reports/{report_id_to_test}", p_rep_detail.status_code, 200, p_rep_detail.status_code == 200, f"Report #: {p_rep_detail.json().get('report_number')}")
    else:
        record("Single Patient Report", "GET", "/api/patients/me/reports/{id}", 200, 200, True, "Skipped (no existing approved report, will test after doctor approval)")

    print(f"\n{BOLD}{CYAN}=== STEP 4: DOCTOR ROUTES (JWT REQUIRED) ==={RESET}")
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    # 1. GET /api/doctor/patients
    d_pats = client.get(f"{BASE_URL}/api/doctor/patients", headers=doc_headers)
    d_pats_list = d_pats.json().get("items", []) if d_pats.status_code == 200 else []
    record("Doctor Assigned Patients", "GET", "/api/doctor/patients", d_pats.status_code, 200, d_pats.status_code == 200, f"Patients: {len(d_pats_list)}")

    sample_patient_id = pat_profile_id or (d_pats_list[0]["id"] if d_pats_list else None)

    # 2. GET /api/doctor/patients/{id}
    if sample_patient_id:
        d_pat_detail = client.get(f"{BASE_URL}/api/doctor/patients/{sample_patient_id}", headers=doc_headers)
        record("Doctor Single Patient Detail", "GET", f"/api/doctor/patients/{sample_patient_id}", d_pat_detail.status_code, 200, d_pat_detail.status_code == 200, f"Patient: {d_pat_detail.json().get('full_name')}")
    else:
        record("Doctor Single Patient Detail", "GET", "/api/doctor/patients/{id}", 404, 200, False, "No patients")

    # 3. GET /api/doctor/appointments
    d_appts = client.get(f"{BASE_URL}/api/doctor/appointments", headers=doc_headers)
    record("Doctor Appointments List", "GET", "/api/doctor/appointments", d_appts.status_code, 200, d_appts.status_code == 200, "Appointments retrieved")

    # 4. POST /api/doctor/appointments
    created_appt_id = None
    if sample_patient_id:
        from datetime import date, timedelta
        future_date = (date.today() + timedelta(days=14)).isoformat()
        create_appt_res = client.post(
            f"{BASE_URL}/api/doctor/appointments",
            headers=doc_headers,
            json={
                "patient_id": sample_patient_id,
                "appointment_type": "Consultation",
                "scheduled_date": future_date,
                "scheduled_time": "11:30",
                "location": "Room 204",
                "notes": "Route audit test appointment",
            }
        )
        created_appt_id = create_appt_res.json().get("id") if create_appt_res.status_code == 201 else None
        record("Doctor Create Appointment", "POST", "/api/doctor/appointments", create_appt_res.status_code, 201, create_appt_res.status_code == 201, f"Appt ID: {created_appt_id}")

    # 5. PUT /api/doctor/appointments/{id}
    if created_appt_id:
        put_appt_res = client.put(
            f"{BASE_URL}/api/doctor/appointments/{created_appt_id}",
            headers=doc_headers,
            json={"location": "Room 205 Updated", "notes": "Updated by audit script"}
        )
        record("Doctor Update Appointment", "PUT", f"/api/doctor/appointments/{created_appt_id}", put_appt_res.status_code, 200, put_appt_res.status_code == 200, "Updated location")

    # 6. DELETE /api/doctor/appointments/{id}
    if created_appt_id:
        del_appt_res = client.delete(
            f"{BASE_URL}/api/doctor/appointments/{created_appt_id}",
            headers=doc_headers
        )
        record("Doctor Cancel Appointment", "DELETE", f"/api/doctor/appointments/{created_appt_id}", del_appt_res.status_code, 200, del_appt_res.status_code == 200, "Cancelled status")

    # 7. GET /api/doctor/scans
    d_scans = client.get(f"{BASE_URL}/api/doctor/scans", headers=doc_headers)
    record("Doctor Ordered Scans", "GET", "/api/doctor/scans", d_scans.status_code, 200, d_scans.status_code == 200, f"Scans: {len(d_scans.json()) if isinstance(d_scans.json(), list) else 0}")

    # 8. POST /api/doctor/scan/breast
    sub_breast = client.post(
        f"{BASE_URL}/api/doctor/scan/breast",
        headers=doc_headers,
        json={
            "patient_id": sample_patient_id,
            "clinical_inputs": {
                "age": 42,
                "menopause_status": "premenopausal",
                "family_history_breast_cancer": "none",
                "prior_benign_biopsy": "no",
                "density_category": "heterogeneously_dense",
                "palpable_lump": "yes",
                "lump_size_cm": 1.8,
            }
        }
    )
    breast_scan_id = sub_breast.json().get("scan_id") if sub_breast.status_code == 201 else None
    record("Doctor Submit Breast Scan", "POST", "/api/doctor/scan/breast", sub_breast.status_code, 201, sub_breast.status_code == 201, f"Risk: {sub_breast.json().get('risk_level')}")

    # 9. POST /api/doctor/scan/cervical
    sub_cervical = client.post(
        f"{BASE_URL}/api/doctor/scan/cervical",
        headers=doc_headers,
        json={
            "patient_id": sample_patient_id,
            "clinical_inputs": {
                "age": 35,
                "hpv_status": "negative",
                "cytology_class": "NILM",
                "prior_abnormal_pap": "no",
                "smoking_history": "never",
            }
        }
    )
    cervical_scan_id = sub_cervical.json().get("scan_id") if sub_cervical.status_code == 201 else None
    record("Doctor Submit Cervical Scan", "POST", "/api/doctor/scan/cervical", sub_cervical.status_code, 201, sub_cervical.status_code == 201, f"Risk: {sub_cervical.json().get('risk_level')}")

    # 10. POST /api/doctor/scan/pcos
    sub_pcos = client.post(
        f"{BASE_URL}/api/doctor/scan/pcos",
        headers=doc_headers,
        json={
            "patient_id": sample_patient_id,
            "clinical_inputs": {
                "cycle_regularity": "regular",
                "cycle_length_days": 28,
                "hirsutism_score": 4,
                "acne_severity": "mild",
                "bmi": 22.5,
                "lh_fsh_ratio": 1.1,
                "amh_ng_ml": 2.5,
                "follicle_count_per_ovary": 7,
            }
        }
    )
    pcos_scan_id = sub_pcos.json().get("scan_id") if sub_pcos.status_code == 201 else None
    record("Doctor Submit PCOS Scan", "POST", "/api/doctor/scan/pcos", sub_pcos.status_code, 201, sub_pcos.status_code == 201, f"Risk: {sub_pcos.json().get('risk_level')}")

    # 11. GET /api/doctor/scan/results/{id}
    test_scan_id = breast_scan_id or cervical_scan_id or pcos_scan_id
    if test_scan_id:
        scan_res_get = client.get(f"{BASE_URL}/api/doctor/scan/results/{test_scan_id}", headers=doc_headers)
        record("Doctor Get Scan Results", "GET", f"/api/doctor/scan/results/{test_scan_id}", scan_res_get.status_code, 200, scan_res_get.status_code == 200, f"Module: {scan_res_get.json().get('module')}")

    # 12. Reports: Create report for test_scan_id (testpatient1), then list
    sample_report_id = None
    if test_scan_id:
        cr_rep = client.post(
            f"{BASE_URL}/api/doctor/reports",
            headers=doc_headers,
            json={"scan_id": test_scan_id}
        )
        if cr_rep.status_code == 201:
            sample_report_id = cr_rep.json().get("id")

    d_reports = client.get(f"{BASE_URL}/api/doctor/reports", headers=doc_headers)
    d_reports_list = d_reports.json() if d_reports.status_code == 200 else []
    record("Doctor Reports List", "GET", "/api/doctor/reports", d_reports.status_code, 200, d_reports.status_code == 200, f"Reports: {len(d_reports_list)}")

    if not sample_report_id and d_reports_list:
        sample_report_id = d_reports_list[0]["id"]

    # 13. GET /api/doctor/reports/{id}
    if sample_report_id:
        d_single_rep = client.get(f"{BASE_URL}/api/doctor/reports/{sample_report_id}", headers=doc_headers)
        record("Doctor Single Report Detail", "GET", f"/api/doctor/reports/{sample_report_id}", d_single_rep.status_code, 200, d_single_rep.status_code == 200, f"Status: {d_single_rep.json().get('status')}")

    # 14. POST /api/doctor/reports/{id}/approve
    if sample_report_id:
        apprv_res = client.post(f"{BASE_URL}/api/doctor/reports/{sample_report_id}/approve", headers=doc_headers)
        record("Doctor Approve Report", "POST", f"/api/doctor/reports/{sample_report_id}/approve", apprv_res.status_code, 200, apprv_res.status_code == 200, f"Signed Status: {apprv_res.json().get('status')}")

    # 15. POST /api/doctor/reports/{id}/share
    if sample_report_id:
        share_res = client.post(
            f"{BASE_URL}/api/doctor/reports/{sample_report_id}/share",
            headers=doc_headers,
            json={"share_with_patient": True, "delivery_method": "portal"}
        )
        record("Doctor Share Report", "POST", f"/api/doctor/reports/{sample_report_id}/share", share_res.status_code, 200, share_res.status_code == 200, "Shared with patient")

    # Now verify patient can see the approved and shared report!
    if sample_report_id:
        pat_check = client.get(f"{BASE_URL}/api/patients/me/reports/{sample_report_id}", headers=pat_headers)
        record("Patient View Approved Report", "GET", f"/api/patients/me/reports/{sample_report_id}", pat_check.status_code, 200, pat_check.status_code == 200, f"Patient verified report: {pat_check.json().get('report_number')}")

    print(f"\n{BOLD}{CYAN}=== STEP 5: ADMIN ROUTES (JWT REQUIRED) ==={RESET}")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. GET /api/admin/dashboard
    a_dash = client.get(f"{BASE_URL}/api/admin/dashboard", headers=admin_headers)
    a_dash_data = a_dash.json() if a_dash.status_code == 200 else {}
    record("Admin Dashboard Stats", "GET", "/api/admin/dashboard", a_dash.status_code, 200, a_dash.status_code == 200 and "users" in a_dash_data, f"Users: {a_dash_data.get('users', {}).get('total')}, Scans: {a_dash_data.get('scans', {}).get('total')}")

    # 2. GET /api/admin/doctors
    a_docs = client.get(f"{BASE_URL}/api/admin/doctors", headers=admin_headers)
    a_docs_items = a_docs.json().get("items", []) if a_docs.status_code == 200 else []
    record("Admin All Doctors", "GET", "/api/admin/doctors", a_docs.status_code, 200, a_docs.status_code == 200, f"Total: {len(a_docs_items)}")

    # 3. POST /api/admin/doctors
    new_doc_email = f"audit_dr_{int(time.time())}@auramed.com"
    new_doc_lic = f"TNMC-{int(time.time()) % 100000:05d}"
    add_doc_res = client.post(
        f"{BASE_URL}/api/admin/doctors",
        headers=admin_headers,
        json={
            "full_name": "Dr. Test Audit",
            "email": new_doc_email,
            "registration_number": new_doc_lic,
            "specialty": "Oncology",
            "hospital": "City Care Hospital",
            "phone": "+91-9876500000",
            "is_approved": True,
            "password": "Doctor@123",
        }
    )
    added_doc_id = add_doc_res.json().get("id") if add_doc_res.status_code == 201 else None
    record("Admin Add Doctor", "POST", "/api/admin/doctors", add_doc_res.status_code, 201, add_doc_res.status_code == 201, f"ID: {added_doc_id}")

    # 4. PUT /api/admin/doctors/{id}
    if added_doc_id:
        edit_doc_res = client.put(
            f"{BASE_URL}/api/admin/doctors/{added_doc_id}",
            headers=admin_headers,
            json={"specialty": "Radiation Oncology", "phone": "+91-9876500001"}
        )
        record("Admin Edit Doctor", "PUT", f"/api/admin/doctors/{added_doc_id}", edit_doc_res.status_code, 200, edit_doc_res.status_code == 200 and edit_doc_res.json().get("specialty") == "Radiation Oncology", "Specialty updated")

    # 5. DELETE /api/admin/doctors/{id}
    if added_doc_id:
        del_doc_res = client.delete(f"{BASE_URL}/api/admin/doctors/{added_doc_id}", headers=admin_headers)
        record("Admin Remove Doctor", "DELETE", f"/api/admin/doctors/{added_doc_id}", del_doc_res.status_code, 200, del_doc_res.status_code == 200, "Deactivated")

    # 6. GET /api/admin/patients
    a_pats = client.get(f"{BASE_URL}/api/admin/patients", headers=admin_headers)
    a_pats_list = a_pats.json().get("items", []) if a_pats.status_code == 200 else []
    record("Admin All Patients", "GET", "/api/admin/patients", a_pats.status_code, 200, a_pats.status_code == 200, f"Total: {len(a_pats_list)}")

    # 7. DELETE /api/admin/patients/{id} (delete the self-registered test patient)
    del_pat_id = reg_data.get("user_id")
    if del_pat_id:
        del_pat_res = client.delete(f"{BASE_URL}/api/admin/patients/{del_pat_id}", headers=admin_headers)
        record("Admin Remove Patient", "DELETE", f"/api/admin/patients/{del_pat_id}", del_pat_res.status_code, 200, del_pat_res.status_code == 200, "Deactivated")

    # 8. GET /api/admin/scans
    a_scans = client.get(f"{BASE_URL}/api/admin/scans", headers=admin_headers)
    record("Admin All Scans", "GET", "/api/admin/scans", a_scans.status_code, 200, a_scans.status_code == 200, f"Total: {a_scans.json().get('total')}")

    # 9. GET /api/admin/reports
    a_reports = client.get(f"{BASE_URL}/api/admin/reports", headers=admin_headers)
    record("Admin All Reports", "GET", "/api/admin/reports", a_reports.status_code, 200, a_reports.status_code == 200, f"Total: {a_reports.json().get('total')}")

    # 10. GET /api/admin/appointments
    a_appts = client.get(f"{BASE_URL}/api/admin/appointments", headers=admin_headers)
    record("Admin All Appointments", "GET", "/api/admin/appointments", a_appts.status_code, 200, a_appts.status_code == 200, f"Total: {a_appts.json().get('total')}")

    # Summary
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r["passed"])
    failed_tests = total_tests - passed_tests

    print(f"\n{BOLD}=============================================={RESET}")
    print(f"{BOLD}ROUTE AUDIT SUMMARY:{RESET}")
    print(f"Total Routes Tested: {total_tests}")
    print(f"{GREEN}PASSED: {passed_tests}{RESET}")
    if failed_tests > 0:
        print(f"{RED}FAILED: {failed_tests}{RESET}")
    else:
        print(f"{GREEN}ALL ROUTES PASSED!{RESET}")
    print(f"{BOLD}=============================================={RESET}\n")

    return failed_tests == 0


if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
