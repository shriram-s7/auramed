# Dashboard workflow contract

Date: 3 October 2026. Status: core guided workflow implemented; verification and remaining gaps are recorded in DASHBOARD_IMPLEMENTATION_STATUS.md. Companion: DASHBOARD_WORKFLOW_AUDIT.md.

## Purpose and boundary

One clinician-led patient record from registration through reviewed findings, agreed next action and documented follow-up. Keep business development and rural programme expansion outside this correction pass. Keep the current doctor, patient and admin roles; an additional coordinator role is a later access-design task, not something the current software already supports.

AI is an optional investigational tool inside this workflow. It does not diagnose, prescribe, certify a report, book an appointment or independently reassure a patient. A clinician can record a visit/result and care plan without image analysis. Non-image visit/result entry is now implemented through the guided visit workflow.

## Doctor navigation

1. **Home**: work needing action, not another analytics dashboard.
2. **Patients**: find/add a patient and open their single record.
3. **Follow-up**: appointments, pending patient requests, referrals and recalls as filters in one workspace.
4. **Reports**: drafts, finalized and released reports from one canonical list.
5. **Settings**: real profile/account/security settings and actual channel readiness only.

Investigational image analysis opens from the selected patient's encounter; an optional Tools entry may expose it with explicit patient selection. No default-first-patient actions.

## One patient's normal journey

### 1. Identify and register

Search existing records by patient ID/name/contact before creating a record. Phone is not a unique person identifier. Collect necessary demographics/contact; separate optional channel, report-sharing and research-AI consent. No forced email or patient portal use. A shared phone has a named recipient/safe-contact preference if supported; that addition requires an explicit data/UI implementation.

Display patient name, patient code and encounter date throughout. On patient change load the selected person's draft or clear inputs. Never carry an image/clinical values to another person unnoticed.

### 2. Create a visit/assessment record

Create or resume one encounter ID. Capture complaint, supplied examination/lab findings and their source/date as appropriate. An external result is recorded as external; a doctor's observation as clinician-entered. Do not convert unknown values to negative/normal. Save drafts to the same ID.

Optional research image analysis: supported module/modality and JPEG/PNG input; currently one selected image. Technical quality check is not proof of correct modality or diagnostically adequate imaging. Explain unsupported input honestly. Version/checkpoint, inference time, input completeness and actual output remain inspectable.

### 3. Doctor reviews and records a decision

Single review page sections:

- Patient/encounter header.
- Source findings and clinical inputs.
- Optional **Research image result** and explanation method in an expandable section.
- **Doctor assessment**: conclusion, remaining uncertainty and evidence.
- **Next action**: no immediate action, local follow-up, repeat/test request, referral or clinician-defined recall, with reason and date where needed.

Priority is separate from diagnosis and review state. 'Priority for review' is not 'confirmed cancer'. Completing review records reviewer/time and next action. Input edits preserve old research output and mark it stale until recomputed.

The doctor may create an urgent referral or appointment before finalizing a report. Report signing is not a barrier to recording timely clinical action.

### 4. Record and coordinate the next action

Local follow-up/recall: record date, time, real location and contact instructions. A recorded booking means staff arranged it; there is no claim that an external clinic's calendar confirmed it automatically.

Referral: patient/source encounter, clinician reason/priority, destination and due next action. Staff record contact attempts and whether contact was actually made. 'Attempted contact' does not equal 'Contacted'. Record confirmed specialist booking, attendance evidence, assessment/outcome and any next task separately.

Suggested display: **Needs contact → Contact confirmed → Visit arranged → Assessment confirmed → Outcome recorded**. Existing backend stage names can map to these labels; unsuccessful attempts need their own event/state support. Declined, cancelled, transferred and unreachable are explicit dispositions rather than success.

When a local appointment is attended, record who confirmed it and when. If specialist outcome is missing, the referral stays open. If outcome recommends another visit/test, create that next task before closing the current referral. Corrections should be auditable; terminal states need an explicit correction/reopen policy.

### 5. Finalize and release a report

Draft report is populated only from actual source results and the doctor's recorded assessment/plan. No invented clinical default. Doctor reviews required content and confirms finalization. Record signer, timestamp and content version; signature is an application sign-off unless a separate verified digital-signature system exists.

Finalized content is immutable through ordinary edit endpoints. Later corrections are addenda/versions with their own author/date. **Release to patient** is explicit and separate. Doctor view, patient view and downloaded PDF display the same released version and plan. Signature status must not be overwritten when visibility changes.

### 6. Patient receives information and requests help

Patient home shows:

- **Your next step**: clinician-written instructions, or 'Your clinician has not recorded the next step yet'.
- **Next confirmed appointment**: actual date/time/location and contact details.
- **Released reports**: clinician-approved summary/PDF and sign-off date.
- Real pending requests/notifications, if any.

No raw fusion probability, automatic normal badge, fake notification, independent generated tissue description or 'line connected' toast.

Rescheduling: patient selects the actual appointment, sends preferred date/time; persistent request appears on doctor's Home/Follow-up. Original confirmed appointment stays unchanged until the doctor accepts a slot. Decline/counterproposal is visible. Success text says 'Request submitted', not 'Rescheduled'.

Cancellation: choose one policy. Recommended for this prototype: patient may cancel their own scheduled visit, with confirmation/reason; this updates the record, stops obsolete reminders and creates follow-up work where needed. If institutional policy requires approval, implement a pending cancellation request instead and label it accurately.

Portal access is optional. No report upload, AI diagnosis or self-booking against nonexistent live clinic slots is promised.

### 7. Follow-up and closure

Doctor Home includes overdue tasks, pending requests, attendance not recorded and outcomes still missing. A past appointment with no attendance evidence is not automatically a no-show. Clinician-approved future recall is a normal dated task, not a second screening prediction.

Close only the particular task/referral whose documented outcome is complete. Closure does not mean cured, disease excluded or all future care finished. Patient record retains the longitudinal factual timeline.

## State definitions that must stay separate

| Object | Proposed states/meaning |
|---|---|
| Research analysis | Not requested, draft, processing, failed/unavailable, completed, stale |
| Clinical review | Awaiting review, reviewed; priority is a separate field |
| Report | Draft/finalized/addendum version; released visibility is separate |
| Appointment | Scheduled/rescheduled, cancelled, attended, explicitly recorded no-show |
| Patient change request | Pending, accepted, declined/counterproposal, withdrawn |
| Referral | Contact needed, contacted, arranged, assessment confirmed, outcome recorded; explicit unresolved/closed disposition |
| Message | Preview, suppressed, pending, accepted, delivered, failed, unknown/superseded |

Not all proposed states currently exist. Implement state validation in shared services used by every role, not independently in each page.

## Home layout and labels

Header: **Today's work** and last successful refresh. Primary action: **Find or add patient**.

Four cards: **Awaiting clinical review**, **Pending patient requests**, **Overdue follow-up tasks**, **Referral outcomes pending**. All use explicit record/date definitions. Card click opens its worklist.

One prioritized table: patient, required action, due date, responsible clinician, current status, next-action button. Show clinical urgency and uncertainty independently. Urgency comes from clinician decision; research rules are suggestions.

Below: today's confirmed appointments and recent factual events. Move operational metrics/export to a secondary view. A stage distribution is labelled a distribution, not conversion. A rate needs period/cohort/denominator; don't hide cancelled cases to improve it.

Patient record tabs: **Overview**, **Visits and results**, **Care plan**, **Reports**, **History**. Overview includes next action and real contact preferences; collapsible history avoids duplicated standalone pages. New encounters and source-specific results are proposed additions to the existing scan-centred data model.

Follow-up tabs/filters: **Appointments**, **Requests**, **Referrals**, **Recalls**. Message history is attached to the related appointment/patient; a troubleshooting message list can remain secondary.

## Messaging scope

Current known constraint from the owner: SMS only to the owner's test number. Display **Test messaging — owner number only** with masked destination. Do not imply that demonstration patients were contacted. If provider restrictions are the only enforcement, disclose that; an explicit application allowlist is a proposed guard to make the scope enforceable before attempting sends.

Actual records may say 'Provider accepted' or 'Delivered' only with corresponding provider evidence. Provider acceptance is not proof of delivery or patient acknowledgement. Email/WhatsApp controls are hidden or labelled unavailable until configured/tested for their actual purpose. The admin fake test endpoints must not be used as verification.

Booking/change/cancellation and reminders use one persisted message workflow and channel consent. An unknown delivery outcome does not trigger blind resend. Messages contain appointment logistics, not medical-result details. No real outbound test is required to review this proposal.

## Admin scope

Accounts/doctor approvals; actual counts; real audit records; measured database/storage/model readiness; channel configuration scope; genuine backup procedure status if available. Hide fabricated service uptime, charts and unsupported cache/feature-flag operations. No administrative impersonation of a clinician to sign a report.

## Acceptance scenarios before calling the dashboard corrected

1. Fresh database: all counts zero; no fictional names, notifications, cases, events, support contacts or health claims.
2. Doctor A has no reports while Doctor B has reports: A sees none and cannot open B's records/files.
3. Patient change during input/upload: no cross-patient values/images; draft resume uses correct encounter/account identity.
4. Repeated draft save: same encounter ID; resume works and no duplicate scan is created.
5. Missing model/invalid image/wrong format: explicit failure, no fabricated score/findings, valid retry and accurate status.
6. Main and retained compatibility scan endpoints: same validated service, no fixed image scores or global patient fallback.
7. No AI request: doctor can record an assessment and next action through the implemented non-image path.
8. Incomplete/moderate assessment: no automatic normal/clear reassurance; patient sees only released doctor summary.
9. Review input correction: old research output marked stale; final report uses actual doctor assessment, not omitted overrides.
10. Finalize/release/edit/addendum: no share-to-auto-sign; all finalized versions locked; patient portal and PDF match actual signer/time/content.
11. Referral opened from a patient's result: correct patient/source filled, destination/location accurate and no fake slot confirmation.
12. Patient reschedule request: survives reload, visible to doctor, original slot unchanged until confirmation; notifications follow confirmed changes.
13. Patient cancellation: own booking only, real state update, obsolete reminder stopped, linked referral follow-up recorded.
14. All dashboards: scheduled/rescheduled/overdue definitions and timezone agree; calendar export matches selected booking exactly.
15. Attendance without specialist outcome: referral stays open. Outcome with another required step creates a visible task.
16. Test message scope: owner-only destination visible/enforced; preview/accepted/delivered/failed states accurate; duplicate clicks do not duplicate sends.
17. Errors: fail visibly, retain last known data with stale label, offer retry; no perpetual loading masquerading as preparation.
18. Admin controls: every visible button has a real verified effect; settings without consumers are absent; no synthetic metrics or claimed full backup from counts.

The target is a smaller, demonstrably consistent system. Additional features are acceptable only when their data, state changes, permissions, failure behaviour and wording can be shown end to end.
