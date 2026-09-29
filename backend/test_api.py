import urllib.request
import urllib.error
import json

BASE = "http://localhost:8000/api"

def test(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"} if body else {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        text = resp.read().decode()
        print(f"  {resp.status} OK: {text[:300]}")
        return json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        print(f"  {e.code} ERROR: {text[:500]}")
        return None

print("=== 1. Health Check ===")
test("GET", "/health")

print("\n=== 2. Admin Login ===")
admin = test("POST", "/auth/admin/login", {"email": "admin@auramed.com", "password": "123"})
admin_token = admin.get("access_token") if admin else None

print("\n=== 3. Doctor Login ===")
doc = test("POST", "/auth/doctor/login", {"identifier": "doctor@auramed.com", "password": "123", "registration_number": "TNMC123456"})
doc_token = doc.get("access_token") if doc else None

print("\n=== 4. Patient Login ===")
pat = test("POST", "/auth/patient/login", {"identifier": "patient@auramed.com", "password": "123"})
pat_token = pat.get("access_token") if pat else None

# Doctor endpoints
if doc_token:
    print("\n=== 5. Doctor Dashboard Summary ===")
    test("GET", "/doctor/dashboard/summary", token=doc_token)
    
    print("\n=== 6. Doctor Urgent Cases ===")
    test("GET", "/doctor/dashboard/urgent-cases", token=doc_token)
    
    print("\n=== 7. Notifications ===")
    test("GET", "/notifications", token=doc_token)
    
    print("\n=== 8. Doctor Patients ===")
    test("GET", "/doctor/patients", token=doc_token)
    
    print("\n=== 9. Doctor Appointments ===")
    test("GET", "/doctor/appointments", token=doc_token)
    
    print("\n=== 10. Doctor Reports ===")
    test("GET", "/doctor/reports", token=doc_token)
    
    print("\n=== 11. Doctor Referrals ===")
    test("GET", "/doctor/referrals", token=doc_token)
    
    print("\n=== 12. Doctor Scans ===")
    test("GET", "/doctor/scans", token=doc_token)
    
    print("\n=== 13. Doctor Activity ===")
    test("GET", "/doctor/activity/logs", token=doc_token)
    
    print("\n=== 14. Doctor Settings ===")
    test("GET", "/doctor/settings/profile", token=doc_token)
    
    print("\n=== 15. Auth Me (Doctor) ===")
    test("GET", "/auth/me", token=doc_token)

# Admin endpoints
if admin_token:
    print("\n=== 16. Admin Dashboard ===")
    test("GET", "/admin/dashboard", token=admin_token)
    
    print("\n=== 17. Admin Doctors List ===")
    test("GET", "/admin/doctors", token=admin_token)
    
    print("\n=== 18. Admin Audit Logs ===")
    test("GET", "/admin/audit-logs", token=admin_token)
    
    print("\n=== 19. Admin Data Requests ===")
    test("GET", "/admin/data-requests", token=admin_token)

# Patient endpoints
if pat_token:
    print("\n=== 20. Patient Dashboard ===")
    test("GET", "/patient/dashboard", token=pat_token)
    
    print("\n=== 21. Patient Reports ===")
    test("GET", "/patient/reports", token=pat_token)
    
    print("\n=== 22. Patient Appointments ===")
    test("GET", "/patient/appointments", token=pat_token)
    
    print("\n=== 23. Patient Timeline ===")
    test("GET", "/patient/timeline", token=pat_token)
    
    print("\n=== 24. Patient Profile ===")
    test("GET", "/patient/profile", token=pat_token)

print("\n=== DONE ===")
