import resend
from app.core.config import settings

resend.api_key = settings.RESEND_API_KEY

FROM_EMAIL = "MIT EXAMS <onboarding@resend.dev>"


def send_otp_email(to_email: str, code: str) -> dict:
    """Send OTP code via Resend."""
    html = f"""
    <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">MIT EXAMS - Mã xác thực</h2>
        <p style="color: #475569;">Mã OTP của bạn là:</p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f172a;">{code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">Mã có hiệu lực trong 5 phút. Không chia mã cho ai.</p>
    </div>
    """
    return resend.Emails.send({
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": "MIT EXAMS - Mã xác thực OTP",
        "html": html,
    })


def send_password_reset_email(to_email: str, reset_url: str) -> dict:
    """Send password reset link via Resend."""
    html = f"""
    <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">MIT EXAMS - Đặt lại mật khẩu</h2>
        <p style="color: #475569;">Bạn đã yêu cầu đặt lại mật khẩu. Nhấn nút bên dưới:</p>
        <div style="text-align: center; margin: 24px 0;">
            <a href="{reset_url}" style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Đặt lại mật khẩu</a>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">Link hết hạn sau 15 phút. Nếu bạn không yêu cầu, bỏ qua email này.</p>
    </div>
    """
    return resend.Emails.send({
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": "MIT EXAMS - Đặt lại mật khẩu",
        "html": html,
    })
