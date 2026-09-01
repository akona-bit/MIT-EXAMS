import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE_URL = "http://localhost:8000/api/v1"

# Need valid tokens to test
# You can replace these with actual tokens if you want to run it live
ADMIN_TOKEN = "replace_with_admin_token"
STUDENT_TOKEN = "replace_with_student_token"
EXAM_ID = 1
STUDENT_USER_ID = 2

async def send_submit():
    async with httpx.AsyncClient() as client:
        try:
            print("[Student] Sending SUBMIT...")
            response = await client.post(
                f"{BASE_URL}/exams/{EXAM_ID}/submit",
                headers={"Authorization": f"Bearer {STUDENT_TOKEN}"},
                timeout=10.0
            )
            print(f"[Student] SUBMIT Response: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"[Student] Exception: {e}")

async def send_suspend():
    async with httpx.AsyncClient() as client:
        try:
            print("[Admin] Sending SUSPEND...")
            response = await client.post(
                f"{BASE_URL}/exams/{EXAM_ID}/suspend?user_id={STUDENT_USER_ID}",
                headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
                timeout=10.0
            )
            print(f"[Admin] SUSPEND Response: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"[Admin] Exception: {e}")

async def main():
    if ADMIN_TOKEN == "replace_with_admin_token":
        print("Please set valid tokens in the script to run the test.")
        return
        
    print("Simulating Race Condition: Concurrent SUBMIT and SUSPEND")
    
    # Run both simultaneously
    await asyncio.gather(
        send_submit(),
        send_suspend()
    )

if __name__ == "__main__":
    asyncio.run(main())
