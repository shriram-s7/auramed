# AuraMed 2.0: screening to follow-through

## Start the presentation

Double-click `start_care_demo.bat` in the project root. Open http://127.0.0.1:5175.

- Doctor: `care.demo@auramed.example`
- Password: `CareDemo@2026`
- Synthetic patient accounts: `care.patient1@example.invalid` through `care.patient6@example.invalid`, password `PatientDemo@2026`.

The launcher uses backend 8010 and frontend 5175 to avoid another checkout on 8000/5173. It refuses occupied ports and never reuses or stops unrelated processes. Alternate unused ports can be supplied to start_care_demo.ps1. Logs are in `tmp/care-demo/`.

This demo uses a separate `backend/auramed_care_demo.db`. Records persist between restarts; the existing hospital database is not replaced. The demo runner forces messaging preview mode even if live provider credentials exist. Its patients, referrals and review scores are explicitly synthetic. Do not represent these as pilot results.

## A six-minute walkthrough

1. **Problem and buyer (45 seconds).** “Screening teams need to know what happened after the result. AuraMed brings the next action, contact history and documented outcome into one workspace. Our initial buyer is a hospital or screening programme that already has clinicians, a coordinator and referral partners.”
2. **Overview (45 seconds).** Show the review queue, overdue appointment and referral stages. Explain that completion is outcomes recorded divided by non-cancelled referrals. The figures are operational demo counts, not measured health improvement.
3. **Review queue (45 seconds).** Show a disagreement flag and poor-quality flag. Research model output prompts clinician review; it is not a confirmed diagnosis. The existing clinical workbench remains available. Synthetic cases demonstrate workflow and do not have real scan uploads. To demonstrate actual image analysis, create a separate case with an appropriate local demo image.
4. **Appointment and messages (90 seconds).** Open Contacts and explain opt-in. Book an appointment on a date without an existing booking, with time and location. Open Messages: show matching email, SMS and WhatsApp previews. Reschedule and show that old queued/previews are superseded. Do not say messages reached a phone in preview mode.
5. **Close the referral loop (75 seconds).** Open Referrals. Record a contact note, schedule, document the visit, then record an outcome. Reload: the history persists and completion metrics change. A referral record does not transmit to a specialist; the care team coordinates with its existing partner.
6. **Business and ask (60 seconds).** “We are testing a facility/programme subscription. A pilot will measure coordination time, overdue work and documented referral completion. We seek a clinical lead, coordinator and access to an existing pathway.” Export the CSV to show a report a programme manager can actually use.

## What is implemented

- Main clinician care dashboard, review worklist, referral stage counts and operational CSV export.
- Referral transitions with mandatory notes, dated history, follow-up targets and recorded outcomes.
- Appointment confirmations, updates, cancellations and reminders with saved outbox records.
- A daily 08:00 clinic-time reminder scan for tomorrow's scheduled/rescheduled visits. Outbox processing every 30 seconds while the backend is running.
- Per-patient email/SMS/WhatsApp preferences; consent is rechecked immediately before delivery.
- SMTP email and Twilio SMS/approved-template WhatsApp adapters. Provider acceptance and confirmed delivery are distinct. SMS/WhatsApp receipts can be refreshed manually.
- Technical image size, exposure, low-detail/possible-blur checks before the main scan-analysis route. These are heuristic checks, not clinically validated quality assessment.
- Persistent synthetic demo without destructive database resets.
- Removed common-password authentication bypass and unsupported compliance claims from the login screen.

## Turn on real messaging for a pilot

Use the normal backend (`uvicorn app.main:app --host 127.0.0.1 --port 8000`) with your intended database, not `run_care_demo.py`. Copy the settings structure from `backend/.env.example` into a private environment file. Do not put credentials in source control or frontend variables.

1. Set `MESSAGING_MODE=live` and `CLINIC_TIMEZONE=Asia/Kolkata`.
2. For email, configure `SMTP_HOST`, `SMTP_PORT` (STARTTLS, usually 587), `SMTP_USERNAME`, `SMTP_PASSWORD`, `FROM_EMAIL`, and `FROM_NAME`. Use a provider-approved sender. Acceptance by SMTP does not confirm inbox delivery.
3. For SMS, configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_SMS_FROM`. The sender must be allowed to reach your recipient country. Complete applicable provider sender registration/template requirements; trial-account restrictions may apply.
4. For WhatsApp, configure `TWILIO_WHATSAPP_FROM` and `TWILIO_WHATSAPP_CONTENT_SID` in addition to the Twilio account credentials. Create an approved utility template with variable `1` carrying the appointment notification text; ensure the approved template supports that variable and intended content. Business-initiated messaging outside the customer-service window requires an approved template. Provider approval is external to AuraMed.
5. Restart the backend. Check Messages for channel readiness. Record an opted-in test recipient's real phone in international format and their email in the existing patient profile. No live external send was performed during implementation.
6. Book a fresh test appointment or use Remind on an active future booking. Preview and blocked historical rows are not automatically released on changing mode. Check provider acceptance, then refresh SMS/WhatsApp receipts. Do not assume an accepted request reached the recipient.

References: [Twilio message resource](https://www.twilio.com/docs/messaging/api/message-resource), [WhatsApp templates](https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates).

## Delivery failure behaviour

- Preview: never sent; excluded from accepted/delivered counts.
- Suppressed: no patient opt-in.
- Blocked: missing provider setup or invalid destination. Correct setup and create a new intended appointment event; existing history is retained.
- Accepted: SMTP or Twilio accepted the request; not proof of delivery.
- Delivered: confirmed by a Twilio status lookup.
- Rate limiting: bounded delayed retries, at most three attempts.
- Unknown: timeout/ambiguous provider failure; no automatic resend because it might duplicate a message. Check provider logs first.
- Processing left after a process crash: requires operator investigation. The worker deliberately does not automatically resend an uncertain in-flight request.

The embedded scheduler is in-process. A separate supervised worker is now available in run_message_worker.py, with startup/periodic reconciliation from persisted appointments. Keep one backend worker for the pilot. An offline backend cannot send at the scheduled time; overdue historical reminders are not sent after the appointment has passed. A production rollout still needs deployment supervision, monitoring, security review and a durable scheduling strategy.

## Scope and remaining evidence

This is a presentable local prototype, not a clinically validated or certified product. Saved ML evaluations are inconsistent and need reproduction with dataset/weight provenance. No retraining, clinical validation, hospital partnership, real specialist delivery network, population screening coverage measure, automatic diagnosis-based recall interval, or compliance certification was introduced. The dashboard is scoped to the current doctor, not a multi-facility administrator.

Public upload serving and the primary-image alias now enforce authentication and ownership. Other legacy routes still need a broader security audit before any real patient deployment. This pass secures the new care routes and fixes the password bypass; it is not a complete security certification. No automatic referral is triggered by AI or report signing: clinicians choose referral priority and follow-up dates.

The commercial hypothesis is a facility/programme subscription with onboarding and messaging costs explicitly costed. No validated price or revenue forecast exists yet. Validate willingness to pay with one bounded pilot before adding enterprise integrations, VIA models, offline inference or marketplace fees.

## Checks

Run `backend/.venv/Scripts/python.exe backend/tests/test_care_coordination.py` from the project root. The tests use an isolated in-memory database and mock providers; they never contact patients. Run `npm --prefix frontend run build` for the production build.

PostgreSQL: apply `alembic upgrade head` from `backend/` before starting. Migration 0005 adds message idempotency and receipt columns. Local SQLite uses a small additive compatibility migration at startup. Back up an existing deployment database before applying schema changes.

## Updated triage and linked referrals

Review queue now exposes routing reasons and image, clinical, combined and confidence values. Missing or invalid evidence, poor/unconfirmed image quality, disagreement above 0.30 and confidence heuristic below 0.65 route to review. These are versioned prototype rules, not validated medical cutoffs or a newly trained diagnostic model. Routine does not mean disease is excluded.

Clinicians can set priority with a mandatory rationale. The original suggested queue and reasons remain visible; changes retain an audit history. Explicit clinician priority sorts first, followed by quality/disagreement review cases, other review cases, elevated research flags and routine cases.

Create referral from a triage card retains the source scan with patient/doctor ownership checks. Record Contacted, then use Book visit. Booking links the appointment, advances the referral to Scheduled and creates appointment messages. The linked appointment status remains visible; coordinators still document specialist attendance, outcomes and any changed follow-up target.

Appointments now offers Active / Overdue / All views and the sidebar opens this same workspace. Messages identify the patient and distinguish superseded messages.

All three trained checkpoints passed strict loading. Missing, corrupt or mismatched weights no longer silently yield random predictions. The main analysis route returns unavailable instead of copying a clinical formula into the image-score channel.

No retraining or improved predictive accuracy is claimed. That requires representative labelled data, patient-separated evaluation and reproduced validation. Existing saved metadata is not clinical validation.

Verification: 19 care workflow tests, 6 triage tests and 2 model-loading safety tests passed. A separate smoke check successfully loaded all three bundled checkpoints.

Latest completion details and external blockers: [Remaining-work handoff](REMAINING_WORK_HANDOFF.md).
