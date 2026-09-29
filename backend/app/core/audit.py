import logging
import uuid
from typing import Any, Optional
from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog

logger = logging.getLogger("auramed.audit")


def _extract_request_info(request: Optional[Request]) -> tuple[Optional[str], Optional[str]]:
    ip_address = None
    user_agent = None
    if request is not None:
        headers = getattr(request, "headers", None) or {}
        forwarded = headers.get("x-forwarded-for")
        if forwarded:
            ip_address = str(forwarded).split(",")[0].strip()
        elif getattr(request, "client", None) and request.client.host:
            ip_address = request.client.host

        user_agent_val = headers.get("user-agent")
        if user_agent_val:
            user_agent = str(user_agent_val)
    return ip_address, user_agent


def _create_audit_log_record(
    db: Session,
    user_id: Any,
    user_type: str,
    action: str,
    resource_type: str,
    resource_id: Any,
    details: Optional[dict],
    request: Optional[Request],
) -> Optional[AuditLog]:
    try:
        ip_address, user_agent = _extract_request_info(request)
        enriched_details = dict(details or {})

        if user_agent and "user_agent" not in enriched_details:
            enriched_details["user_agent"] = user_agent

        parsed_user_id = None
        if user_id is not None:
            if isinstance(user_id, uuid.UUID):
                parsed_user_id = user_id
            else:
                try:
                    parsed_user_id = uuid.UUID(str(user_id))
                except (ValueError, TypeError, AttributeError):
                    enriched_details["raw_user_id"] = str(user_id)

        parsed_resource_id = None
        if resource_id is not None:
            if isinstance(resource_id, uuid.UUID):
                parsed_resource_id = resource_id
            else:
                try:
                    parsed_resource_id = uuid.UUID(str(resource_id))
                except (ValueError, TypeError, AttributeError):
                    enriched_details["raw_resource_id"] = str(resource_id)

        normalized_action = str(action).strip().upper()

        entry = AuditLog(
            user_id=parsed_user_id,
            user_type=str(user_type) if user_type else None,
            action=normalized_action,
            resource_type=resource_type,
            resource_id=parsed_resource_id,
            details=enriched_details,
            ip_address=ip_address,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry
    except Exception as e:
        logger.error(f"Error recording audit log for {action}: {e}", exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass
        return None


async def log_audit_event(
    db: Session,
    user_id: Any,
    user_type: str,
    action: str,
    resource_type: str,
    resource_id: Any = None,
    details: Optional[dict] = None,
    request: Optional[Request] = None,
) -> Optional[AuditLog]:
    """
    Creates an AuditLog record in the database.
    Extracts IP address from request headers.
    Extracts user agent from request headers.
    Never raises an exception (wrapped in try/except)
    so a logging failure never breaks the main operation.
    """
    return _create_audit_log_record(
        db=db,
        user_id=user_id,
        user_type=user_type,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        request=request,
    )


def log_audit_event_sync(
    db: Session,
    user_id: Any,
    user_type: str,
    action: str,
    resource_type: str,
    resource_id: Any = None,
    details: Optional[dict] = None,
    request: Optional[Request] = None,
) -> Optional[AuditLog]:
    """Synchronous variant of log_audit_event."""
    return _create_audit_log_record(
        db=db,
        user_id=user_id,
        user_type=user_type,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        request=request,
    )
