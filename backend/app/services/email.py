import httpx
from app.core.config import settings

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def _send(to_email: str, subject: str, html: str) -> dict:
    """Send email via Brevo API."""
    headers = {
        "api-key": settings.BREVO_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "sender": {"email": settings.BREVO_FROM_EMAIL, "name": "MIT EXAMS"},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html,
    }
    resp = httpx.post(BREVO_API_URL, json=payload, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json()


def _base_wrapper(body_content: str) -> str:
    """Wrap body in email template."""
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif,'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol';">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg, #2563eb, #4f46e5);padding:40px 48px;text-align:center;">
              <div style="font-size:32px;font-weight:800;color:#ffffff;letter-spacing:2px;margin-bottom:8px;text-shadow: 0 2px 4px rgba(0,0,0,0.1);">MIT EXAMS</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.9);font-weight:500;">Nền tảng thi trắc nghiệm trực tuyến</div>
            </td>
          </tr>
          <tr>
            <td style="padding:48px;">
              {body_content}
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 40px;background-color:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-top:24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;line-height:1.6;">
                    <p style="margin:0 0 6px;">© 2026 MIT EXAMS. All rights reserved.</p>
                    <p style="margin:0;">Đây là email gửi tự động, vui lòng không phản hồi lại địa chỉ này.</p>
                    <p style="margin:6px 0 0 0;">Nếu cần được hỗ trợ, hãy nhắn với developer thông qua Discord: <strong>akona_e</strong> (hoặc qua <a href="https://discordapp.com/users/734403880208564235" style="color:#2563eb;text-decoration:underline;">link này</a>).</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def send_otp_email(to_email: str, code: str) -> dict:
    """Send OTP code via Brevo."""
    body = f"""
      <div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:12px;">Xác thực Đăng nhập</div>
      <div style="font-size:15px;color:#475569;line-height:1.6;margin-bottom:24px;">Mã xác thực đăng nhập của bạn là:</div>
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);">
        <span style="font-size:42px;font-weight:800;color:#2563eb;letter-spacing:14px;font-family:'SF Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">{code}</span>
      </div>
      <div style="font-size:14px;color:#64748b;line-height:1.6;">
        <p style="margin:0 0 8px;">Mã xác thực này có hiệu lực trong <strong style="color:#dc2626;">5 phút</strong>.</p>
        <p style="margin:0;">Vui lòng không chia sẻ mã này cho bất kỳ ai. Nếu bạn không yêu cầu đăng nhập, bạn có thể an tâm bỏ qua email này.</p>
      </div>
    """
    return _send(to_email, "MIT EXAMS - Mã xác thực Đăng nhập", _base_wrapper(body))


def send_password_reset_email(to_email: str, code: str) -> dict:
    """Send password reset OTP via Brevo."""
    body = f"""
      <div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:12px;">Đặt lại Mật khẩu</div>
      <div style="font-size:15px;color:#475569;line-height:1.6;margin-bottom:24px;">
        Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản liên kết với email này. Sử dụng mã OTP dưới đây để tiếp tục:
      </div>
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);">
        <span style="font-size:42px;font-weight:800;color:#2563eb;letter-spacing:14px;font-family:'SF Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">{code}</span>
      </div>
      <div style="font-size:14px;color:#64748b;line-height:1.6;">
        <p style="margin:0 0 8px;">Mã xác thực này có hiệu lực trong <strong style="color:#dc2626;">5 phút</strong>.</p>
        <p style="margin:0;">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này và đảm bảo tài khoản của bạn được an toàn.</p>
      </div>
    """
    return _send(to_email, "MIT EXAMS - Mã xác thực Đặt lại mật khẩu", _base_wrapper(body))
