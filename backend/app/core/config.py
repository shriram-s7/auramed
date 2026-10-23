from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_minutes: int = 60 * 24 * 7
    password_reset_expire_minutes: int = 30
    upload_dir: str = "uploads"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    max_file_size_mb: int = 50
    patient_portal_url: str = "http://localhost:5173/patient"

    # SMTP configuration
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    from_email: str = "noreply@auramed.in"
    from_name: str = "AuraMed"
    # Preview is explicit and never contacts an external provider.
    messaging_mode: str = "preview"
    clinic_timezone: str = "Asia/Kolkata"
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_sms_from: str | None = None
    twilio_whatsapp_from: str | None = None
    twilio_whatsapp_content_sid: str | None = None
    notification_scheduler_enabled: bool = True
    allow_database_fallback: bool = False

    # Deep learning weights paths
    breast_model_path: str = "app/ml/weights/breast_model.pth"
    cervical_model_path: str = "app/ml/weights/cervical_model.pth"
    pcos_model_path: str = "app/ml/weights/pcos_model.pth"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
