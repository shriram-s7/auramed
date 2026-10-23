"""Closed-loop referral transitions. Events are stored with the referral and audited."""
from datetime import datetime, timezone
from fastapi import HTTPException

STAGES = ["referred", "contacted", "scheduled", "seen", "outcome_recorded"]
TRANSITIONS = {
    "referred": {"contacted", "cancelled"},
    "contacted": {"scheduled", "seen", "cancelled"},
    "scheduled": {"contacted", "seen", "cancelled"},
    "seen": {"outcome_recorded"},
    "outcome_recorded": set(), "cancelled": set(),
}


def stage_of(referral):
    return {"pending": "referred", "sent": "referred", "accepted": "contacted",
            "completed": "seen"}.get(referral.status, referral.status)


def transition_referral(referral, new_stage, note, actor, due_date=None):
    old = stage_of(referral)
    if new_stage != old and new_stage not in TRANSITIONS.get(old, set()):
        raise HTTPException(422, f"Cannot move referral from {old} to {new_stage}.")
    if old in ('outcome_recorded', 'cancelled'):
        raise HTTPException(422, 'This referral is closed.')
    if not note or not note.strip():
        raise HTTPException(422, "Record a contact note or outcome to support this change.")
    att = dict(referral.attachments or {})
    now = datetime.now(timezone.utc).isoformat()
    events = list(att.get("care_events", []))
    events.append({"from": old, "to": new_stage, "note": note.strip(), "at": now, "actor": str(actor)})
    att["care_events"] = events
    att["care_updated_at"] = now
    if due_date:
        att["care_due_date"] = str(due_date)
    if new_stage == "outcome_recorded":
        att["care_outcome"] = note.strip()
        att["care_closed_at"] = now
    referral.attachments = att
    referral.status = new_stage


def sync_linked_referrals(db, appointment, actor):
    """Keep coordinator tasks aligned; appointment attendance is not specialist proof."""
    from app.models.referral import Referral
    from app.services.care_messaging import clinic_today
    for ref in db.query(Referral).filter(Referral.from_doctor_id == appointment.doctor_id,
                                        Referral.patient_id == appointment.patient_id).all():
        if (ref.attachments or {}).get('care_appointment_id') != str(appointment.id):
            continue
        stage = stage_of(ref)
        if stage in ('seen', 'outcome_recorded', 'cancelled'):
            continue
        state = appointment.status.value
        if state in ('cancelled', 'no_show') and stage == 'scheduled':
            transition_referral(ref, 'contacted',
                f'Linked visit {state}; contact patient and arrange the next visit.', actor,
                clinic_today())
        elif state == 'rescheduled' and stage in ('contacted', 'scheduled'):
            transition_referral(ref, 'scheduled',
                f'Linked visit rescheduled to {appointment.scheduled_date} at {appointment.scheduled_time}.',
                actor, appointment.scheduled_date)
        elif state == 'completed':
            transition_referral(ref, stage,
                'Linked appointment attended. Confirm specialist assessment and record its outcome separately.', actor)
