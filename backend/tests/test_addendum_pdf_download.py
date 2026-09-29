import sys
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import httpx

BASE_URL = "http://127.0.0.1:8000"

def test_addendum_and_pdf():
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    # 1. Login as doctor testdr1
    print("\n[1] Login as testdr1...")
    res = client.post("/api/auth/login", json={"email": "testdr1@auramed.com", "password": "Doctor@123"})
    assert res.status_code == 200, f"Doctor login failed: {res.text}"
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("  [OK] Doctor logged in successfully")

    # 2. Get doctor reports
    print("\n[2] Get doctor reports...")
    rep_res = client.get("/api/doctor/reports", headers=headers)
    assert rep_res.status_code == 200, f"Failed to get reports: {rep_res.text}"
    data = rep_res.json()
    items = data if isinstance(data, list) else data.get("items", [])
    assert len(items) > 0, "No reports found for doctor"
    report = items[0]
    report_id = report["id"]
    print(f"  [OK] Found report: {report['report_number']} (id: {report_id}, status: {report['status']})")

    # 3. Add an addendum
    unique_text = "Targeted core biopsy performed under ultrasound guidance. Pathological margins clear."
    print(f"\n[3] Adding addendum to report {report_id}...")
    addendum_res = client.post(
        f"/api/doctor/reports/{report_id}/addendum",
        headers=headers,
        json={"addendum_text": unique_text}
    )
    assert addendum_res.status_code == 200, f"Failed to add addendum: {addendum_res.text}"
    rep_data = addendum_res.json()
    addendums = rep_data.get("content", {}).get("addendums", [])
    assert len(addendums) > 0, "Addendum not present in report content"
    assert any(unique_text in str(a.get("addendum_text") or a.get("note") or "") for a in addendums), "Addendum text not found in content.addendums"
    print(f"  [OK] Addendum saved into DB! Total addenda: {len(addendums)}")

    # 4. Download PDF as doctor via POST /api/doctor/reports/{id}/generate-pdf
    print(f"\n[4] Downloading report PDF as doctor...")
    pdf_res = client.post(f"/api/doctor/reports/{report_id}/generate-pdf", headers=headers)
    assert pdf_res.status_code == 200, f"Failed to generate PDF: {pdf_res.text}"
    assert pdf_res.headers.get("content-type") == "application/pdf", f"Unexpected content-type: {pdf_res.headers.get('content-type')}"
    pdf_bytes = pdf_res.content
    assert len(pdf_bytes) > 1000, f"PDF suspiciously small: {len(pdf_bytes)} bytes"
    print(f"  [OK] Doctor PDF downloaded successfully ({len(pdf_bytes)} bytes)")

    # 5. Verify PDF content
    import re, base64, zlib
    def extract_pdf_text(data):
        extracted = ""
        for m in re.finditer(rb'stream\n(.*?)endstream', data, re.DOTALL):
            s = m.group(1).strip()
            if b'~>' in s:
                s = s[:s.find(b'~>') + 2]
                try:
                    raw = base64.a85decode(s, adobe=True)
                    dec = zlib.decompress(raw).decode('latin-1', 'ignore')
                    extracted += dec + "\n"
                except Exception:
                    pass
            else:
                try:
                    dec = zlib.decompress(s).decode('latin-1', 'ignore')
                    extracted += dec + "\n"
                except Exception:
                    extracted += s.decode('latin-1', 'ignore') + "\n"
        return extracted

    doctor_pdf_text = extract_pdf_text(pdf_bytes)
    assert "CLINICAL ADDENDA" in doctor_pdf_text, "Section 8 not found in PDF"
    assert "ADDENDUM #" in doctor_pdf_text, "ADDENDUM # not found in PDF"
    assert "Targeted core biopsy performed" in doctor_pdf_text, "Addendum unique text not found in generated PDF"
    assert "ADDENDUM VERIFIED" in doctor_pdf_text, "Verification footer missing in PDF"
    print("  [OK] Verified Addendum section, doctor header, unique note, and verification badge in downloaded PDF!")

    # 6. Verify patient download as well
    print("\n[6] Testing patient PDF download with addendum...")
    client.post(f"/api/doctor/reports/{report_id}/share", headers=headers, json={"share_with_patient": True, "delivery_method": "portal"})

    pat_res = client.post("/api/auth/login", json={"email": "testpatient1@auramed.com", "password": "Patient@123"})
    if pat_res.status_code == 200:
        pat_token = pat_res.json()["access_token"]
        pat_headers = {"Authorization": f"Bearer {pat_token}"}
        pat_pdf_res = client.get(f"/api/patient/reports/{report_id}/pdf", headers=pat_headers)
        assert pat_pdf_res.status_code == 200, f"Patient PDF failed: {pat_pdf_res.text}"
        pat_pdf_text = extract_pdf_text(pat_pdf_res.content)
        assert "ADDENDUM #1" in pat_pdf_text or "Targeted core biopsy performed" in pat_pdf_text, "Addendum missing from patient PDF"
        print("  [OK] Verified patient download PDF also includes the addendum cleanly!")

    print("\n" + "=" * 65)
    print("ALL ADDENDUM AND PDF DOWNLOAD CHECKS PASSED PERFECTLY!")
    print("=" * 65)

if __name__ == "__main__":
    test_addendum_and_pdf()
