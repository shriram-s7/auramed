import uuid

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.enums import UserRole
from app.models.user import User
from app.services.audit import log_action

bearer_scheme = HTTPBearer(auto_error=False)


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        log_action(
            db,
            user_id=None,
            user_type=None,
            action="unauthorized_access_attempt",
            resource_type="route",
            resource_id=None,
            details={"path": request.url.path, "reason": "missing_token"},
            ip_address=_client_ip(request),
        )
        raise unauthorized

    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        log_action(
            db,
            user_id=None,
            user_type=None,
            action="unauthorized_access_attempt",
            resource_type="route",
            resource_id=None,
            details={"path": request.url.path, "reason": "invalid_token"},
            ip_address=_client_ip(request),
        )
        raise unauthorized

    if payload.get("type") != "access":
        log_action(
            db,
            user_id=None,
            user_type=None,
            action="unauthorized_access_attempt",
            resource_type="route",
            resource_id=None,
            details={"path": request.url.path, "reason": "wrong_token_type"},
            ip_address=_client_ip(request),
        )
        raise unauthorized

    user_id = payload.get("sub")
    try:
        user_uuid = uuid.UUID(user_id)
    except (TypeError, ValueError):
        raise unauthorized

    user = db.query(User).filter(User.id == user_uuid).first()
    if user is None or not user.is_active:
        log_action(
            db,
            user_id=None,
            user_type=None,
            action="unauthorized_access_attempt",
            resource_type="route",
            resource_id=user_uuid,
            details={"path": request.url.path, "reason": "user_not_found_or_inactive"},
            ip_address=_client_ip(request),
        )
        raise unauthorized

    # Doctor Session Tracking & Revocation Check
    if user.role == UserRole.doctor:
        try:
            from datetime import datetime
            from app.models.session import DoctorSession
            jti = payload.get("jti") or (credentials.credentials[-16:] if credentials else None)
            if jti:
                doc_sess = (
                    db.query(DoctorSession)
                    .filter(
                        DoctorSession.user_id == user.id,
                        DoctorSession.token_jti == jti,
                    )
                    .first()
                )
                if doc_sess:
                    if doc_sess.is_revoked or doc_sess.is_expired:
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Session has been revoked",
                            headers={"WWW-Authenticate": "Bearer"},
                        )
                    doc_sess.last_active = datetime.utcnow()
                    try:
                        db.commit()
                    except Exception:
                        db.rollback()
                request.state.current_session_jti = jti
        except HTTPException:
            raise
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass

    request.state.current_user = user
    request.state.token_payload = payload
    return user


def require_role(*allowed_roles: UserRole):
    def dependency(
        request: Request,
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ) -> User:
        if user.role not in allowed_roles:
            log_action(
                db,
                user_id=user.id,
                user_type=user.role.value,
                action="forbidden_access_attempt",
                resource_type="route",
                resource_id=None,
                details={"path": request.url.path, "required_roles": [r.value for r in allowed_roles]},
                ip_address=_client_ip(request),
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )
        return user

    return dependency


require_admin = require_role(UserRole.admin)
require_doctor = require_role(UserRole.doctor)
require_patient = require_role(UserRole.patient)


def get_current_doctor_profile(
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor),
):
    from app.models.doctor_profile import DoctorProfile

    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Doctor profile not found")
    return profile
