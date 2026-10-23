"""Supervised single-worker entry point. API: NOTIFICATION_SCHEDULER_ENABLED=false."""
import argparse
import logging
import time
from app.core.database import SessionLocal
import app.models
from app.services.care_messaging import queue_catchup_reminders, process_outbox


def tick():
    with SessionLocal() as db:
        queue_catchup_reminders(db)
        process_outbox(db)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    while True:
        try:
            tick()
        except Exception:
            logging.exception('Messaging worker failed; persisted rows retained for next reconciliation')
            if args.once:
                raise
        if args.once:
            break
        time.sleep(30)
