from app.worker import celery_app
from app.services.email import send_otp_email, send_password_reset_email

@celery_app.task(name="send_otp_email_task", bind=True, max_retries=3)
def send_otp_email_task(self, to_email: str, code: str):
    """Celery task to send OTP email asynchronously."""
    try:
        send_otp_email(to_email, code)
    except Exception as exc:
        # Retry up to 3 times with 5s delay if Brevo API fails or network error occurs
        raise self.retry(exc=exc, countdown=5)


@celery_app.task(name="send_password_reset_email_task", bind=True, max_retries=3)
def send_password_reset_email_task(self, to_email: str, code: str):
    """Celery task to send password reset email asynchronously."""
    try:
        send_password_reset_email(to_email, code)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=5)
