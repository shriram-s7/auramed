# Remaining-work implementation and external prerequisites

## Implemented in this pass

- Cancelled or missed linked appointments return scheduled referrals to Contacted with a follow-up task. Rescheduling updates the referral target date. Appointment attendance adds evidence without falsely claiming a completed specialist assessment.
- Clinician-approved screening recalls use real appointments, explicit dates and mandatory rationale. They appear in Recalls and use the same consent-aware reminder workflow.
- Reminder reconciliation runs at startup and every five minutes, catching eligible reminders after downtime. The persisted outbox still prevents duplicate event sends. Interrupted sending attempts become Unknown rather than being blindly resent.
- A separate message-worker entry point supports a supervised deployment. Run only one reminder worker and disable the API scheduler when using it.
- Public uploads and the unprotected primary-image alias have been replaced with authenticated, patient/doctor-scoped routes. Clinical image views now fetch protected images with bearer authentication. Administrative access alone does not grant image access on these routes.
- Unexpected API errors no longer return raw exception details. PostgreSQL connection failures stop startup instead of silently selecting a different database. Development fallback requires an explicit setting.
- A frozen-manifest evaluation tool checks patient and identical-image separation between splits and records checkpoint/manifest hashes. It uses deployed preprocessing, preserves weights and does not tune on test results.
- Local SQLite backup utility verifies database and upload-archive integrity and refuses to overwrite an existing backup directory.

## Live messaging: not yet enabled

The local configuration has no usable SMTP or Twilio credentials. No real patient contact was attempted. An account owner must provide provider-approved sender details, credentials and an opted-in test destination. WhatsApp also needs its approved template. Then use the normal backend in live mode, book a fresh test appointment, inspect acceptance and refresh delivery receipts. Do not use the demo runner: it intentionally forces preview.

## Model evaluation: what the available files support

Local training/data folders contain synthetic datasets. The generated JSON reports under docs/evaluation are smoke checks only, not clinical performance evidence. They do not prove that the test images were excluded from historical training. Existing metadata claims are not reproduced clinical results.

For held-out evaluation prepare one CSV with image_path,label,patient_id,split,source_kind. Use pseudonymous patient IDs, real source_kind, and train/validation/test rows. Labels must follow the deployed class order. Obtain lawful access and expert labels before importing real data. Run training/evaluate_checkpoint.py with --purpose heldout and a threshold selected using validation data only. A passing manifest check does not independently establish provenance or clinical validity.

## Deployment procedure to finish with an operator

1. Choose the target host and intended database. Keep the synthetic demo separate. Set a unique secret and private database credentials; put no credentials in frontend variables or Git.
2. Back up and restore to a separate staging instance first. For SQLite run backend/backup_local.py with explicit database, uploads and new destination paths while uploads are paused. For PostgreSQL use the hosting provider's verified backup/restore procedure; the SQLite utility does not support PostgreSQL.
3. Apply migrations from backend using alembic upgrade head. Set ALLOW_DATABASE_FALLBACK=false. Validate sign-in, isolation between doctors/patients, protected files and report sharing in staging.
4. Serve behind HTTPS on the chosen host with explicit CORS origins. Configure process supervision and restricted filesystem access. This pass does not publish the application or configure a host that has not been supplied.
5. Set NOTIFICATION_SCHEDULER_ENABLED=false for the API and supervise backend/run_message_worker.py separately. It scans persisted work every 30 seconds. Monitor restarts, failed/unknown messages and backups. Unknown provider outcomes require manual investigation.
6. Verify a single opted-in live messaging test. Expand only after receipt checks and operational ownership are established.

## Customer pilot: prepared, not performed

Recruit one facility with a clinical lead and coordinator. Define a fixed cohort and observation period before collecting results. Record referrals created, contact attempts, specialist visits, outcomes, cancellations, overdue counts and staff coordination minutes. Compare equivalent baseline and pilot periods and report denominators; do not attribute changes to AuraMed without considering other changes.

Use the pilot log template alongside operational exports. Ask the buyer who owns the budget, current coordination costs, required integrations and what evidence would justify payment. Pricing and willingness to pay remain hypotheses until the buyer confirms them. No outreach, contract, hospital partnership or sale was performed.

## Still outside completion

Real provider setup and delivery, representative labelled-data evaluation/retraining, independent clinical review, target-host deployment, full legacy-system security audit, institutional facility/tenant permissions, and an actual customer pilot require external inputs. A polished local prototype is not clinical or production certification.
