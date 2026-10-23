# Dashboard implementation and verification

Updated: 4 October 2026. Workspace: E:\auramed.

## Implemented workflow

Patients → select/add patient → start visit → record findings and source → clinician assessment and patient instructions → complete review → arrange appointment/referral/recall → finalize report → explicitly release to patient.

The doctor Home includes a quick-start guide, review worklist and pending patient requests. Each visit has numbered steps. Follow-up opens with the selected patient and offers a return-to-visit link. Reports open the same visit workflow. Saving the written plan is explicitly distinguished from making a booking.

The patient sees released clinician content and real appointments. A requested alternative time is stored as pending; the confirmed slot changes only after doctor acceptance. Cancellation updates the booking and withdraws pending requests. The doctor can accept or decline with a response. Attendance and cancellation now ask for a note instead of recording a generic invented confirmation.

Research image analysis is optional and consent-gated. The visible flow does not generate anatomical findings or diagnose from a classifier score. JPEG/PNG single-image input only. Model failure returns an error; no fixed-score fallback is mounted. Report text is clinician-authored, finalization locks it, and subsequent notes use addendums. PDF and patient report use the same clinical content.

Invented profile details, specialist directory, admin notifications/accuracy claims and sample image diagnosis labels were removed from the active flow. Unsupported admin email/SMS tests, cache and backup actions return explicit unavailable responses. Password-reset delivery and 2FA are not represented as working services.

## Verification evidence

- Frontend production build passed (non-blocking bundle-size warning).
- Backend Python compilation passed.
- Focused isolated suite: 43 tests passed: care coordination, guided workflow, triage, strict model loading and release tooling. Run backend/tests/run_workflow_checks.py using the backend virtual environment.
- Browser, synthetic demo only: completed clinician review, finalized report, confirmed fields locked, released to patient, booked 9 October 2026 at 11:15 for the selected patient, signed in as that patient and confirmed plan/report/booking visibility.
- Browser: requested 10 October at 12:15, reloaded, confirmed Pending persisted and original 9 October booking remained unchanged. Fixed date/time input handling found during this test.
- The focused tests verify request acceptance, cancellation withdrawal, report release gating, clinician ownership, report PDF generation and finalized-review locks.

## Limits and unresolved verification

This is a corrected demonstration workflow, not a certified or fully validated clinical product. Do not claim the whole repository is green: broad legacy discovery ran 109 tests with 7 failures and 26 errors. Observed causes include incompatible shared database/test setup (missing users table) and tests expecting the fabricated model findings intentionally removed. Those legacy suites need separate migration and reconciliation; their failures have not been dismissed as all harmless.

No new clinical model training or clinical accuracy validation was performed. Synthetic demo scores remain explicitly labelled synthetic. SMS provider restrictions to the owner's test number remain; no external messages were sent for these checks. Email/WhatsApp delivery to real recipients was not verified. Specialist referrals are manual coordination records, not live partner bookings.

Production deployment requires applying migration 0006 after 0005, verifying backups and access controls in the target environment, and restarting the backend. The demo runner creates the new table in its separate synthetic database. The isolated demo backend was restarted with the final edits; frontend changes refresh automatically.

Additional engineering work before a real pilot includes concurrent request-resolution transactions, comprehensive legacy route/security regression coverage, retention/deletion policy implementation, responsive usability testing across devices, and clinician-led usability and model validation. Historical signed reports are not silently rewritten; start a new reviewed visit for the new release workflow.

## Open and demonstrate

Start start_care_demo.ps1. Default preview: http://127.0.0.1:5175. It uses a separate persistent synthetic database and preview messaging.

Doctor: care.demo@auramed.example / CareDemo@2026
Patient: care.patient1@example.invalid / PatientDemo@2026

Use Home → Patients → patient → Start a visit. The synthetic verification appointment and pending change request are retained so the doctor can demonstrate Requests → accept/decline. Never use these demonstration credentials or database for deployment.
