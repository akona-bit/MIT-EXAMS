"""
Locust load test for MIT EXAMS API.
Simulates realistic student exam behavior.

Usage:
    1. Start backend: uvicorn app.main:app --host 0.0.0.0 --port 8000
    2. Run: locust -f locustfile.py
    3. Open http://localhost:8089
    4. Set host to http://localhost:8000
    5. Configure users and spawn rate
"""

from locust import HttpUser, task, between, events
import random
import string
import os


class StudentUser(HttpUser):
    """Simulates a student taking an online exam."""
    wait_time = between(2, 8)  # Realistic think time between actions

    def on_start(self):
        """Login and get exam session on start."""
        self.exam_id = int(os.getenv("TEST_EXAM_ID", "1"))
        self.token = None
        self.form_code = None
        self.questions = []
        self.answered = set()

        # Try to authenticate
        self._login()

    def _login(self):
        """Attempt login with test credentials."""
        try:
            # Try SBD-based login (common for students)
            sbd = f"{random.randint(100000, 999999)}"
            res = self.client.post("/api/v1/auth/login", json={
                "username": sbd,
                "password": "test1234",
            }, name="/auth/login")
            if res.status_code == 200:
                self.token = res.json().get("access_token")
                if self.token:
                    self.client.headers["Authorization"] = f"Bearer {self.token}"
                    return
        except Exception:
            pass

        # Fallback: use env var token
        env_token = os.getenv("TEST_TOKEN", "")
        if env_token:
            self.token = env_token
            self.client.headers["Authorization"] = f"Bearer {env_token}"

    def _ensure_session(self):
        """Get exam session if not already loaded."""
        if self.questions:
            return
        try:
            res = self.client.get(
                f"/api/v1/exams/{self.exam_id}/session",
                name="/exams/{id}/session"
            )
            if res.status_code == 200:
                data = res.json()
                self.questions = data.get("questions", [])
                self.form_code = data.get("form_code")
        except Exception:
            pass

    @task(5)
    def submit_answer(self):
        """Submit an answer for a random unanswered question."""
        self._ensure_session()
        if not self.questions:
            return

        # Pick a random question we haven't answered yet
        unanswered = [q for q in self.questions if q["exam_form_question_id"] not in self.answered]
        if not unanswered:
            # Reset — simulate re-answering
            self.answered.clear()
            unanswered = self.questions

        q = random.choice(unanswered)
        answer_id = random.randint(1, 4)

        payload = {
            "answers": [{
                "exam_form_question_id": q["exam_form_question_id"],
                "selected_answer_id": answer_id,
            }]
        }

        with self.client.post(
            f"/api/v1/exams/{self.exam_id}/autosave",
            json=payload,
            name="/exams/{id}/autosave",
            catch_response=True,
        ) as response:
            if response.status_code in (200, 201):
                response.success()
                self.answered.add(q["exam_form_question_id"])
            elif response.status_code == 403:
                response.failure("Forbidden — session may have expired")
            else:
                response.failure(f"Status {response.status_code}")

    @task(3)
    def fetch_exam_status(self):
        """Fetch current exam session status (timer, progress)."""
        self.client.get(
            f"/api/v1/exams/{self.exam_id}/session",
            name="/exams/{id}/session"
        )

    @task(1)
    def fetch_question_content(self):
        """Fetch a random question's full content (passage, images)."""
        self._ensure_session()
        if not self.questions:
            return

        q = random.choice(self.questions)
        self.client.get(
            f"/api/v1/questions/{q.get('question_id', 1)}",
            name="/questions/{id}"
        )

    @task(1)
    def track_violation(self):
        """Simulate anti-cheat tracking (tab switch, blur)."""
        action = random.choice(["TAB_CHANGED", "BLUR_WINDOW", "COPY_ATTEMPT"])
        self.client.post(
            f"/api/v1/exams/{self.exam_id}/track",
            json={"action_type": action},
            name="/exams/{id}/track",
        )


class TeacherUser(HttpUser):
    """Simulates a teacher/admin viewing analytics."""
    wait_time = between(3, 10)
    weight = 1  # Fewer teachers than students

    def on_start(self):
        env_token = os.getenv("TEST_ADMIN_TOKEN", "")
        if env_token:
            self.client.headers["Authorization"] = f"Bearer {env_token}"
        self.exam_id = int(os.getenv("TEST_EXAM_ID", "1"))

    @task(3)
    def view_exam_detail(self):
        self.client.get(
            f"/api/v1/exams/{self.exam_id}",
            name="/exams/{id}"
        )

    @task(2)
    def view_statistics(self):
        self.client.get(
            f"/api/v1/statistics/exams/{self.exam_id}/overview",
            name="/statistics/overview"
        )

    @task(1)
    def view_item_analysis(self):
        self.client.get(
            f"/api/v1/statistics/exams/{self.exam_id}/items",
            name="/statistics/items"
        )

    @task(1)
    def view_students(self):
        self.client.get(
            f"/api/v1/admin/exams/{self.exam_id}/participants-detail",
            name="/admin/participants"
        )
