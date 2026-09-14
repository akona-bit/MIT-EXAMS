from app.services.email import send_otp_email, send_password_reset_email

# Tasks are now handled via FastAPI BackgroundTasks directly in the auth module.
