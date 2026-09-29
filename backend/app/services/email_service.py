"""
Transactional Email Service and Clinical HTML Templates for AuraMed.
Supports SMTP with TLS for production and structured console output in development mode.
"""
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import os
import smtplib
from typing import Optional

from app.core.config import settings

logger = logging.getLogger("auramed.email")


class EmailService:
    """
    Transactional email sender for AuraMed.
    Uses smtplib with TLS when SMTP_HOST is configured, or logs to console in development.
    """
    def __init__(
        self,
        smtp_host: Optional[str] = None,
        smtp_port: Optional[int] = None,
        smtp_username: Optional[str] = None,
        smtp_password: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
    ):
        self.smtp_host = smtp_host or os.getenv("SMTP_HOST") or settings.smtp_host
        self.smtp_port = int(smtp_port or os.getenv("SMTP_PORT") or settings.smtp_port or 587)
        self.smtp_username = smtp_username or os.getenv("SMTP_USERNAME") or settings.smtp_username
        self.smtp_password = smtp_password or os.getenv("SMTP_PASSWORD") or settings.smtp_password
        self.from_email = from_email or os.getenv("FROM_EMAIL") or settings.from_email or "noreply@auramed.in"
        self.from_name = from_name or os.getenv("FROM_NAME") or settings.from_name or "AuraMed"

    @property
    def is_configured(self) -> bool:
        """Returns True if valid SMTP credentials and server host are available."""
        return bool(self.smtp_host and self.smtp_username and self.smtp_password)

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        """
        Sends an email via SMTP with TLS or logs to console in development.
        Returns True on success, False on delivery failure.
        """
        if self.is_configured:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = f"{self.from_name} <{self.from_email}>"
                msg["To"] = to_email

                # Plain-text fallback
                plain_body = text_content or html_content
                msg.attach(MIMEText(plain_body, "plain", "utf-8"))

                # HTML body
                if html_content:
                    msg.attach(MIMEText(html_content, "html", "utf-8"))

                server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15)
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(self.smtp_username, self.smtp_password)
                server.sendmail(self.from_email, [to_email], msg.as_string())
                server.quit()

                logger.info("Successfully sent email to %s with subject: %s", to_email, subject)
                return True
            except Exception as e:
                logger.error("Failed to send email to %s via SMTP (%s): %s", to_email, self.smtp_host, str(e), exc_info=True)
                return False
        else:
            # Development Mode Console Output
            content_display = text_content if text_content else html_content
            dev_output = (
                "\n=== EMAIL (dev mode) ===\n"
                f"To: {to_email}\n"
                f"Subject: {subject}\n"
                f"Content: {content_display}\n"
                "======================\n"
            )
            print(dev_output)
            logger.info("Email simulated (dev mode) to %s: %s", to_email, subject)
            return True


# =============================================================================
# CLINICAL HTML & TEXT EMAIL TEMPLATES
# =============================================================================

def report_shared_email(
    patient_name: str,
    doctor_name: str,
    module: str,
    report_date: str,
    portal_url: str,
) -> str:
    """Template for notifying a patient that a diagnostic screening report is ready."""
    clean_module = (module or "diagnostic").capitalize()
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #0A1628; margin: 0; padding: 24px; }}
    .card {{ max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; border: 1px solid #E2E8F0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .logo {{ font-size: 24px; font-weight: bold; color: #0A1628; }}
    .tagline {{ font-size: 13px; color: #0D9488; margin-bottom: 24px; }}
    .btn {{ display: inline-block; background-color: #0D9488; color: #FFFFFF !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 20px 0; }}
    .disclaimer {{ font-size: 12px; color: #64748B; line-height: 1.5; border-top: 1px solid #E2E8F0; padding-top: 16px; margin-top: 24px; }}
    .footer {{ font-size: 12px; color: #94A3B8; text-align: center; margin-top: 20px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">AuraMed</div>
    <div class="tagline">AI for Women's Health</div>

    <p>Dear {patient_name},</p>
    <p>Your <b>{clean_module}</b> screening report from <b>{report_date}</b> has been reviewed and shared by Dr. {doctor_name}.</p>
    <p>You can view your report by logging into the AuraMed patient portal.</p>

    <div style="text-align: center;">
      <a href="{portal_url}" class="btn" target="_blank">View Report</a>
    </div>

    <p>If you have any questions about your report, please contact your doctor directly.</p>

    <div class="disclaimer">
      <b>Important:</b> This report is a clinical decision support document. Please discuss your results with your healthcare provider.
    </div>

    <div class="footer">
      &copy; AuraMed Healthcare Intelligence. All rights reserved.<br>
      Confidential Medical Communication
    </div>
  </div>
</body>
</html>"""


def appointment_reminder_email(
    patient_name: str,
    appointment_type: str,
    doctor_name: str,
    appointment_date: str,
    appointment_time: str,
    location: str,
) -> str:
    """Template for notifying a patient about an upcoming medical consultation."""
    app_type = appointment_type or "Medical Consultation"
    loc = location or "AuraMed Clinical Facility"
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #0A1628; margin: 0; padding: 24px; }}
    .card {{ max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; border: 1px solid #E2E8F0; padding: 32px; }}
    .logo {{ font-size: 22px; font-weight: bold; color: #0A1628; }}
    .tagline {{ font-size: 12px; color: #0D9488; margin-bottom: 20px; }}
    .details-box {{ background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 16px; margin: 16px 0; }}
    .reminder {{ background: #FEF3C7; border-left: 4px solid #D97706; padding: 12px; border-radius: 4px; font-size: 13px; margin: 16px 0; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">AuraMed</div>
    <div class="tagline">AI for Women's Health</div>

    <p>Dear {patient_name},</p>
    <p>This is a reminder for your upcoming medical appointment:</p>

    <div class="details-box">
      <b>Appointment Type:</b> {app_type}<br>
      <b>Attending Physician:</b> Dr. {doctor_name}<br>
      <b>Date:</b> {appointment_date}<br>
      <b>Time:</b> {appointment_time}<br>
      <b>Location:</b> {loc}
    </div>

    <div class="reminder">
      <b>Important:</b> Please arrive <b>15 minutes early</b> to complete baseline check-in and vitals verification. Bring any previous medical scans or records.
    </div>

    <p>If you need to reschedule or cancel, please contact the clinic at your earliest convenience.</p>
  </div>
</body>
</html>"""


def doctor_verified_email(
    doctor_name: str,
    login_url: str,
) -> str:
    """Template for notifying an approved doctor."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #0A1628; margin: 0; padding: 24px; }}
    .card {{ max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; border: 1px solid #E2E8F0; padding: 32px; }}
    .btn {{ display: inline-block; background-color: #16A34A; color: #FFFFFF !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 20px 0; }}
  </style>
</head>
<body>
  <div class="card">
    <h2>AuraMed Account Verified - You Can Now Login</h2>
    <p>Dear Dr. {doctor_name},</p>
    <p>Welcome to AuraMed! Your medical registration credentials and hospital affiliation have been thoroughly verified by our clinical administration team.</p>
    <p>You now have full access to our multimodal screening modules, diagnostic trajectory analysis, and clinical decision support system.</p>

    <div style="text-align: center;">
      <a href="{login_url}" class="btn" target="_blank">Access Doctor Portal</a>
    </div>

    <p>Thank you for partnering with us to advance women's healthcare.</p>
  </div>
</body>
</html>"""


def doctor_rejected_email(
    doctor_name: str,
    reason: str,
) -> str:
    """Template for notifying a rejected doctor registration with explanation."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #0A1628; margin: 0; padding: 24px; }}
    .card {{ max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; border: 1px solid #E2E8F0; padding: 32px; }}
    .reason-box {{ background: #FEF2F2; border-left: 4px solid #DC2626; padding: 14px; margin: 16px 0; font-size: 14px; }}
  </style>
</head>
<body>
  <div class="card">
    <h2>AuraMed Registration Update</h2>
    <p>Dear Dr. {doctor_name},</p>
    <p>Thank you for your interest in joining the AuraMed clinical network. Following a review of your application, we were unable to approve your registration at this time.</p>

    <div class="reason-box">
      <b>Reason for Decision:</b><br>
      {reason}
    </div>

    <p>If you believe this was an error or would like to provide updated medical council credentials, please contact our administrative team at support@auramed.in.</p>
  </div>
</body>
</html>"""


def deletion_approved_email(
    patient_name: str,
) -> str:
    """Template confirming completion of a patient data deletion request."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #0A1628; margin: 0; padding: 24px; }}
    .card {{ max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; border: 1px solid #E2E8F0; padding: 32px; }}
  </style>
</head>
<body>
  <div class="card">
    <h2>Data Deletion Request Approved</h2>
    <p>Dear {patient_name},</p>
    <p>We are writing to confirm that your request for personal data deletion on the AuraMed platform has been approved and processed in accordance with healthcare privacy regulations.</p>
    <p>Your identifiable personal information and account credentials have been permanently anonymized or removed, subject to statutory medical record retention obligations.</p>
    <p>If you have any further questions, please contact our Data Protection Office at privacy@auramed.in.</p>
  </div>
</body>
</html>"""
