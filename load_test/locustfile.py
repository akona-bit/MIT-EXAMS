from locust import HttpUser, task, between
import random

class StudentUser(HttpUser):
    wait_time = between(1, 5)

    def on_start(self):
        # Giả lập đăng nhập thí sinh để lấy JWT token
        # Bạn cần cung cấp endpoint login thực tế và account test
        self.client.headers = {"Authorization": "Bearer MOCK_TOKEN_HERE"}
        self.exam_id = 1
        self.exam_session_id = 1

    @task(3)
    def submit_answer(self):
        # Giả lập thí sinh chọn đáp án cho 1 câu hỏi
        question_id = random.randint(1, 120)
        answer_id = random.randint(1, 4)
        
        payload = {
            "question_id": question_id,
            "selected_answer_id": answer_id
        }
        
        self.client.post(
            f"/api/v1/exams/{self.exam_id}/session/answers",
            json=payload,
            name="Submit Answer"
        )

    @task(1)
    def fetch_exam_status(self):
        # Giả lập thí sinh lấy thời gian còn lại / trạng thái làm bài
        self.client.get(
            f"/api/v1/exams/{self.exam_id}/session",
            name="Get Exam Session"
        )
