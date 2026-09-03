import asyncio
import os
import sys

# Add backend directory to sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.email import _send

def test_email():
    try:
        response = _send(
            to_email="minhducle629@gmail.com", # Send to self for testing
            subject="Test Email MIT EXAMS",
            html="<h1>Test Email</h1><p>Gửi email thành công từ hệ thống.</p>"
        )
        print("Email sent successfully!")
        print(response)
    except Exception as e:
        print(f"Failed to send email: {e}")

if __name__ == "__main__":
    test_email()
