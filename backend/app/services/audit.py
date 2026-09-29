import uuid
from typing import Any, Optional
from fastapi import Request
from sqlalchemy.orm import Session

from app.core.audit import log_audit_event, log_audit_event_sync
from app.models.audit_log import AuditLog


def log_action(
    db: Session,
    *,
    user_id: Any = None,
    user_type: Optional[str] = None,
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Any = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
    request: Optional[Request] = None,
) -> Optional[AuditLog]:
    return log_audit_event_sync(
        db=db,
        user_id=user_id,
        user_type=user_type or "system",
        action=action,
        resource_type=resource_type or "general",
        resource_id=resource_id,
        details=details,
        request=request,
    )


__all__ = ["log_action", "log_audit_event", "log_audit_event_sync"]
