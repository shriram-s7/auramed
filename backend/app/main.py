import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes.auth import router as auth_router
from app.api.routes.doctor_dashboard import router as doctor_dashboard_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.patient_detail import router as patient_detail_router
from app.api.routes.patients import router as patients_router
from app.api.routes.appointments import router as appointments_router
from app.api.routes.referrals import router as referrals_router
from app.api.routes.admin import router as admin_router
from app.api.routes.patient_portal import router as patient_portal_router
from app.api.routes.doctor_activity import router as doctor_activity_router
from app.api.routes.doctor_settings import router as doctor_settings_router
from app.api.routes.public import router as public_router
from app.api.routes.reports import router as reports_router
from app.api.routes.scan_results import router as scan_results_router
from app.api.routes.scans import router as scans_router
from app.api.routes.patients_portal_me import router as patients_portal_me_router
from app.api.routes.doctor_scans_submission import router as doctor_scans_submission_router
from app.core.config import settings

from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

app = FastAPI(title="AuraMed API")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
if "http://localhost:5173" not in origins:
    origins.append("http://localhost:5173")
if "http://127.0.0.1:5173" not in origins:
    origins.append("http://127.0.0.1:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    message = detail if isinstance(detail, str) else str(detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": message,
            "detail": message,
            "code": exc.status_code,
        },
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    message = "; ".join([f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}" for err in errors])
    return JSONResponse(
        status_code=422,
        content={
            "error": True,
            "message": message,
            "detail": message,
            "code": 422,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "message": f"Internal server error: {str(exc)}",
            "detail": f"Internal server error: {str(exc)}",
            "code": 500,
        },
    )

app.include_router(auth_router)
app.include_router(public_router)
app.include_router(doctor_dashboard_router)
app.include_router(notifications_router)
app.include_router(patients_router)
app.include_router(patient_detail_router)
app.include_router(scans_router)
app.include_router(scan_results_router)
app.include_router(reports_router)
app.include_router(appointments_router)
app.include_router(referrals_router)
app.include_router(admin_router)
app.include_router(patient_portal_router)
app.include_router(doctor_activity_router)
app.include_router(doctor_settings_router)
app.include_router(patients_portal_me_router)
app.include_router(doctor_scans_submission_router)

os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/scans/{scan_id}/primary-image")
def get_primary_image_alias(scan_id: str):
    from app.core.database import SessionLocal
    from app.models.scan import Scan
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Scan not found")
        return {
            "scan_id": str(scan.id),
            "image_url": f"/{scan.image_path}" if scan.image_path else None,
            "image_path": scan.image_path,
        }
    finally:
        db.close()


@app.post("/api/reports/{report_id}/share")
async def share_report_alias(report_id: str, request: Request):
    from app.api.routes.reports import share_report, ShareReportRequest
    from app.api.deps import get_current_user
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        user = get_current_user(request, db=db)
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        payload = ShareReportRequest(**body) if body else ShareReportRequest()
        return share_report(report_id=report_id, payload=payload, db=db, user=user)
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    from app.core.database import Base, engine, SessionLocal
    import app.models  # noqa
    Base.metadata.create_all(bind=engine)


    try:
        from app.ml.models.model_loader import ModelLoader
        model_loader = ModelLoader.get_instance()
        model_loader.load_all_models()
        model_loader.verify_models_startup()
    except Exception as e:
        print(f"[AuraMed] WARNING: Model verification step failed: {str(e)}")

    try:
        from app.services.notifications import start_notification_scheduler
        start_notification_scheduler()
    except Exception:
        pass


@app.on_event("shutdown")
def on_shutdown():
    try:
        from app.services.notifications import stop_notification_scheduler
        stop_notification_scheduler()
    except Exception:
        pass
