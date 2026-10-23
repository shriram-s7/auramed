> Historical audit findings before implementation. For fixes, verification evidence and remaining gaps, read [DASHBOARD_IMPLEMENTATION_STATUS.md](DASHBOARD_IMPLEMENTATION_STATUS.md).

# AuraMed dashboard: source audit and proposed fixes

Date: 3 October 2026. Workspace: E:/auramed.

This is an audit and design proposal, not a statement that the fixes below have been implemented. No application behaviour, patient data, model weights or provider configuration was changed in this pass. Business positioning is deferred as requested. SMS is understood to be restricted to the owner's test number; that is an intentional test limitation, not proof that general patient messaging works.

## Evidence and coverage

Reviewed the active React route map, its doctor/patient/admin pages and service calls, registered backend routers, patient identity, scan inference, result construction, report generation/release, appointments, referrals, care transitions, messaging, notifications, settings, activity and metrics. The accompanying DASHBOARD_ROUTE_INVENTORY.json inventories 150 route declarations across 19 route files, including duplicate method/path declarations. This inventory is static, not a live API test.

Findings below distinguish reachable endpoints from the frontend's main path and distinguish working persistence from decorative/fabricated content. There was no current browser tab available for inspection. UI conclusions are based on the components and their calls; this is not a complete click-through, penetration test or clinical validation. No outbound messages, destructive administrative actions or real-patient tests were performed.

## Module decisions

| Area | Current evidence | Decision for the first clean dashboard |
|---|---|---|
| Sign-in and accounts | Real role-based sign-in and doctor approval; reset-email delivery and 2FA incomplete | Keep sign-in; remove unsupported security promises and settle patient enrolment |
| Patient registration/list/detail | Persistent records, notes and histories; consent and shared-phone issues | Keep; simplify registration and use one patient identity |
| Doctor home | CareHub plus a separate clinical overview | Merge into one actionable Home |
| Breast analysis | Real main-path ResNet inference; threshold-derived descriptive findings | Keep as an investigational mammography score, not anatomical detection |
| Cervical analysis | Real main-path cell-image classifier and attention map | Keep as investigational cell classification, not VIA/colposcopy diagnosis |
| PCOS analysis | Real main-path classifier, clinical rules and criteria flags | Keep under investigational tools; clinician criteria review, not confirmed diagnosis |
| Combined scoring/confidence | Weighted rules and heuristic adjustments | Separate evidence sources; do not call these calibrated disease probabilities |
| Review queue | Persistent clinician priority overrides | Keep; separate priority from completed clinical review |
| Reports | Real records/PDF/sign/release paths; fabricated defaults and inconsistent release logic | Keep one canonical clinician-approved report and one PDF source |
| Appointments/recalls | Doctor actions persist; patient actions currently log only | Keep one calendar/worklist and real request confirmation |
| Referrals | Real tracking and notes; no connected specialist booking network | Keep honest manual coordination and outcome evidence |
| SMS/email/WhatsApp | Care outbox/adapters and status history; separate admin test buttons are fake | Keep supported test channel with explicit scope; hide unavailable channels |
| Patient home/reports | Real record queries but fabricated summaries and notifications | Keep only released clinician content and real upcoming actions |
| Activity/timeline | Real audit events mixed with synthetic activity templates | Keep real event history; remove runtime fabrication |
| Admin | Real account/record administration mixed with fictional counts/status and no-op actions | Keep accounts, audit and measured readiness; reduce settings drastically |
| Public page | Already labels prototype/research and some roadmap gaps | Keep; reconcile channel capability wording with actual configuration |

## Confirmed issues and valid fixes

Priority P0 means resolve before presenting the affected feature as trustworthy. P1 means necessary for a coherent end-to-end demonstration. P2 means simplification or supporting work.

### P0: claims and evidence

1. **A second registered scan path fabricates evidence.** `backend/app/main.py` includes `doctor_scans_submission.py`. Its `_process_scan_submission` starts with image score 0.75 and preset findings; `_find_patient` accepts unscoped patient lookup and can fall back to the first patient in the database. The main ScanModule calls `/api/doctor/scans/analyze`, a different route with real inference. Fix: retire the legacy `/api/doctor/scan/...` endpoints or delegate them to the same validated, owned-patient inference service. Invalid/missing patient IDs must fail; never substitute another patient.

2. **The real breast classifier still produces unmeasured anatomical findings.** `backend/app/ml/models/breast_model.py`, `run_breast_inference`, turns scalar score bands into density, mass and distortion statements. This is classification-based wording, not separately measured lesion morphology. Fix: return actual model/class score and limitations. Anatomical findings must be clinician-entered or come from a separately supported detector; do not attach invented finding confidence.

3. **Fallback clinical findings remain in the main analyzer.** `backend/app/api/routes/scans.py`, `analyze_scan`, contains preset masses, margins and ovarian findings when findings are absent. Main inference now fails closed if inference itself is unavailable; this remaining narrative fallback is a separate issue. Fix: absent findings stay absent. Mark analysis unavailable/failed explicitly and provide retry without leaving a case looking indefinitely active.

4. **Patient report text is largely fabricated from a high/not-high branch.** `backend/app/api/routes/patient_portal.py`, `get_patient_report_detail`, constructs tissue symmetry, node findings, a 1.4 cm observation and clear/no-intervention statements rather than displaying the signed content. Moderate risk is collapsed into the non-high branch. Fix: render the same clinician-approved summary, recorded observations and next plan as the doctor report. Do not generate an independent patient diagnosis.

5. **Missing risk becomes normal in multiple patient paths.** `translate_risk_level` defaults missing risk to low, and report listings use low when scan/risk is missing. Fix: distinguish not assessed, incomplete, awaiting review and clinician-released result. Missing data must never turn into a green normal badge.

6. **Doctor reports invent missing findings and confidence.** `backend/app/services/report_service.py`, `_build_default_report_content`, supplies density/node findings, an 85% confidence fallback, generic recommendations and a fixed 60/40 label. Fix: omit unavailable fields and require doctor-authored assessment/plan. Use recorded model version/actual weights where shown; a heuristic confidence is not diagnostic confidence.

7. **Patient PDF reconstruction fabricates signatory details.** `backend/app/api/routes/patient_portal.py`, `download_patient_report_pdf`, rebuilds a report using a fixed signed date, registration number and specialty. `generate_clinical_report_pdf` also wraps supplied content with default scan values. Fix: patient download must serve the same canonical signed report/version as doctor download, with actual signer and timestamps.

8. **Signing/releasing is not one guarded lifecycle.** `reports.py` share can auto-approve a draft. Signing fills missing clinical sections with assertions. Patch/save locks only signed/addendum, so approved/shared statuses can escape that protection. Patient queries expose signed/approved reports even when not explicitly shared. Fix: require explicit clinician completion before signing, separate release visibility from signature state, lock all finalized versions, and use addenda for later changes. Appointment/referral creation need not wait for report signature.

9. **Heuristic scores are described as calibrated and can imply confirmation.** `backend/app/ml/confidence.py` starts from 0.70 and applies rules; `fusion.py` uses fixed weights and PCOS tier 'confirmed'. No independent calibration evidence is established. Cervical formula receives predicted cytology and PCOS formula can receive image-derived criteria, so fusion inputs are not independent corroboration. Fix: show a separate research output and input-quality/review flags. Suppress unvalidated combined probability/confirmed labels in the core dashboard. Do not solve this by choosing new arbitrary thresholds.

10. **Explainability wording overclaims localization.** `AiVisualIntelligenceSection.jsx` says 'exactly' which regions drove risk and calls all maps Grad-CAM; cervical implementation uses transformer attention. Fix: label actual explanation method and say it is a visualization of model activation/attention, not a verified lesion boundary or diagnosis. Remove the 'Novelty Feature' badge.

### P0: access and false-success actions

11. **Duplicate report-list endpoint, incompatible responses and cross-doctor fallback.** `reports.py` declares GET `/api/doctor/reports` twice. The first returns a bare list and falls back to all doctors' reports; `DoctorReports.jsx` expects `items`, `stats` and `total` from the second. Registration order makes the first handler take precedence in normal dispatch. Its filtered branch also references `func` without importing it. Fix: one scoped, paginated handler and one response contract. Empty means empty, never other users' records.

12. **Patient reschedule/cancel returns success without changing the appointment.** `patient_portal.py`, `reschedule_appointment` and `cancel_appointment`, only log an action and return a status. They do not fetch an owned appointment, persist the change, or create an actionable request object. Fix: rescheduling creates a persistent pending request shown to the doctor; approval alone changes the confirmed slot. Cancellation updates the owned booking and its messages/referral task, or is explicitly a request if that is the chosen policy. The UI must match that policy.

13. **Admin test email/SMS never sends.** `admin.py`, `test_email` and `test_sms`, immediately return success text. This is separate from the real care messaging adapter. Fix: remove these actions or connect to the actual provider/outbox with an owner-approved test destination and real receipts. Never expand the user's test-number restriction during this audit.

14. **Admin health/performance values are invented.** `admin.py`, `get_system_status`, hardcodes AI/email/backup healthy, latencies and uptime despite separately checking database/storage. Fix: measured database/storage readiness, model loading availability and provider configuration states. Unknown must be unknown; configured is not delivered or healthy.

15. **Admin statistics inflate a small database.** `get_admin_stats` adds 1420 patients, 48 doctors and 3890 reports for small counts, sets four pending requests when zero, and returns fixed growth/chart series. Fix: actual queries and dated aggregates; show zero and empty states. Synthetic demo data belongs only in a separately labelled seed/demo environment.

16. **Administrative operations claim completion without proof.** `clear_cache` is no-op; clear_drafts reports deletion without deleting; approval/rejection handlers swallow errors and may report success for invalid IDs. Data-erasure approval changes selected fields but claims a purge job without evidence that a complete erasure ran. Fix: remove no-op buttons; enforce owned/valid records, verified transaction outcomes and explicit retention/erasure scope. Do not perform destructive cleanup as part of this audit.

17. **UI backup is not a recoverable database backup.** `trigger_database_backup` exports counts/timestamps; download_backup exports settings cache. The separate `backend/backup_local.py` is a different, genuine SQLite backup utility. Fix: rename current UI exports accurately or wire a verified backup/restore procedure appropriate to the deployment; no 'Full backup' badge for table statistics.

### P1: continuity of the patient workflow

18. **Changing selected patient can carry another patient's input/image.** `ScanModule.jsx` resets values/images on module change, not patient change; local draft writes then use the new patient key. Fix: patient+module+encounter change must explicitly load that patient's draft or clear the form, with discard confirmation for unsaved input. Browser-local medical drafts need per-account isolation and logout cleanup or replacement with server drafts.

19. **Saved drafts lack a complete resume path.** `/scans/draft` creates a new scan each save; `saveScanDraft` does not preserve/reuse its ID. Analysis directly uploads a new scan. Fix: create one draft encounter, save updates to its ID, resume it from the worklist, and preserve the identity through analysis/review/report. Do not count drafts as analyzed scans.

20. **DICOM and multi-view promises exceed the main analyzer.** `scanModules.js` advertises DICOM and four mammography views; `analyze_scan` accepts `additional_images` but never uses them, and decodes the main file with Pillow. The main route does not demonstrate DICOM parsing. Fix now: validated JPEG/PNG, one explicitly selected primary image, honest unsupported-format feedback and explicit 'additional images not analyzed' only if retained as attachments. Multi-view/DICOM need real implementations before advertising.

21. **The referral button loses source context.** `NextStepsSection.jsx` navigates with `patientId`/`scanId`; `CareHub.jsx` does not consume those query parameters and default referral modal selects the first patient. `/referrals/new/:patientId` likewise opens a tab, not a prefilled referral. Fix: explicit patient/source encounter context opens the intended action; validate ownership and mismatch server-side; never silently select first patient.

22. **Referral destination/booking can conflict.** CareHub's linked referral appointment defaults location to the doctor's facility, not the referral destination. Fixed specialist catalog in `referrals.py` contains fabricated availability/reviews. Fix: manually maintained verified destination, confirmed location/time and confirmation source. Label recorded bookings as arranged by staff; no claim of connected specialist availability.

23. **Attendance is too easy to confuse with assessment/outcome.** Doctor appointment 'Attended' submits a generic completion note; referrals separately require seen/outcome. Existing sync deliberately avoids treating attendance as specialist proof, which should be preserved. Fix: attendance recorder/date, specialist-assessment confirmation and diagnostic outcome are distinct. UI asks for evidence; missing outcome remains open.

24. **Clinician review has multiple unconnected meanings.** Priority override only reprioritizes; result field edits are stored in `doctor_modifications`; report defaults do not use these edits; review queue excludes reported scans rather than using explicit review completion. Fix: separate 'Set priority' from 'Complete review'; one doctor assessment/plan feeds reports and tasks. Changing an input marks dependent research results stale rather than silently implying recomputation.

25. **Follow-up rules contradict each other.** Main analyzer suggests 7/30/75/365 days; report text, ScanShare defaults and settings use different intervals; scheduling from scan results omits time/location. Fix: one clinician-selected next action/date/time/location with rationale. Research suggestions never auto-book or independently replace that plan. Remove unsatisfied preferences until they are actually consumed.

26. **Rescheduled/overdue bookings disappear or disagree across pages.** Several patient/list/detail/dashboard queries only include scheduled; patient-detail overdue calculation checks dates already filtered to today/future, so cannot become overdue. CareHub includes rescheduled/no-show. Fix: one active-status/date definition and clinic timezone across all views; past unconfirmed attendance is 'attendance not recorded', not automatically no-show. No-show requires a recorded observation.

27. **Calendar download and visual markers use fixed dates.** `PatientAppointments.jsx` uses September 2026 defaults, day 18 and fixed DTSTART/DTEND regardless of record. Fix: generate calendar from the selected confirmed appointment with timezone, real date/time and stable ID; remove mini calendar if only decorative.

28. **SMS permission does not match enrolment consent.** NewPatient requires an aggregate appointment-reminders consent; care messages require separate explicit sms/email/whatsapp flags. Registration also requires sharing consent. Fix: separate essential record consent from optional research AI, sharing and each communication channel. Allow care without agreeing to optional channels. Display 'Test SMS: verified owner number only'; check provider result and do not claim patient contact if a message goes to the owner.

29. **Shared phone is treated as duplicate patient.** Doctor registration rejects another patient with the same phone. Email is optional, but patient users receive a generated local email when absent; self-registration is a separate account pathway. Fix: patient ID is identity, phone is a contact that may be shared. Select existing patient carefully; introduce explicit account linking/activation rather than duplicate enrolment. Keep portal optional; invitation/activation and recovery require a real supported path.

30. **Synthetic history and personal identity appear in normal UI.** `doctor_activity.py` always inserts sample events, matching global patient codes where possible. PatientTopbar has three fixed notifications and a demo-report link. Names/registration numbers/help contacts in several UI components fall back to invented people or numbers. Fix: actual scoped events/profile, real notifications, loading/error states and verified support details. No runtime demonstration events mixed with actual activity.

31. **Settings do not necessarily change behaviour.** Doctor 2FA toggle persists a boolean but no second-factor login flow was found; clinical preferences have no consumers outside their settings/profile definitions. Default verified status, last login and addresses also contain preset claims. Admin has broad feature flags without established enforcement. Fix: expose only settings with an implemented effect; use measured status. Remove 2FA control until enrollment, challenge and recovery actually exist.

32. **Failure handling can masquerade as empty, normal or forever-loading.** Patient report detail logs API errors then continues showing preparation spinner; patient dashboards use sample-name/count defaults; CareHub background refresh failures are silent. Global doctor/patient search updates layout-local state without searching content. Fix: explicit loading/empty/error/stale states, actionable retry and last successful refresh. Keep page-level search; remove global search until results/navigation are real.

33. **Metrics/trends imply more than their denominators support.** CareHub's journey counts current stages, not cumulative conversion; completion is outcomes/all noncancelled referrals all time. Clinical overview counts every nondraft scan as analyzed, including analyzing/archived. Patient risk history substitutes tier-based numbers for missing scores and trajectory labels score changes improving/worsening. Fix: show operational status distribution/counts and defined periods; no patient improvement claims from unvalidated score trends. Keep raw model history only in research details with provenance.

34. **Password recovery promises an email that is not sent.** `auth.py` forgot_password generates/logs a reset token and returns sent-email wording, with no provider wired there. Fix: real recovery delivery or explicit local/demo unsupported recovery. Stop logging reset tokens in normal deployments. Avoid unsupported recovery links in the demonstration flow.

## Remove or hide from the core UI

- Duplicate clinical overview, activity analytics and standalone recalls/contacts navigation: consolidate into Home, patient record and Follow-up.
- Seven analysis tabs, duplicated heatmap panels, novelty badges and classification-driven anatomical narratives: use one review page with expandable research details.
- Disease-risk trajectories and combined risk/confidence percentages in patient screens.
- Preset specialist rankings/availability and fake phone support.
- Unsupported DICOM/multi-view processing, fake admin provider tests, cache clearing, backup claims and unused settings.
- Educational carousels/resources competing with the patient's next action. Optional general education must be clearly separate from their report.
- One-click report approval as a side effect of sharing.

Keep all three model tools available as explicitly investigational tools if desired. PCOS does not have to be deleted to simplify the workflow. Preserve records and reusable code; remove or feature-gate unsupported paths rather than delete user data.

## Fix order

1. Remove invented clinical statements, fake successful actions and cross-user fallback. Consolidate report route/response contract. Close legacy inference endpoint.
2. Make patient switching/drafts safe. Establish one clinician assessment, finalized report version and explicit release policy.
3. Make appointment requests persistent, preserve confirmed slots until approval, synchronize status/messages/referral tasks and calendar.
4. Repair source-linked referrals and evidence-backed attendance/outcome. Keep the test-number messaging constraint visible.
5. Simplify navigation, remove misleading metrics/settings and unify empty/error/stale states.
6. Exercise the acceptance scenarios in DASHBOARD_FINAL_WORKFLOW.md using an isolated labelled demo. This audit itself does not claim those checks passed.
