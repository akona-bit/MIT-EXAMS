# Load Testing with Locust

## Setup

```bash
pip install locust
```

## Configuration

Set environment variables before running:

```bash
# Required for student simulation
export TEST_EXAM_ID=1          # Exam ID to test against
export TEST_TOKEN=<jwt_token>  # Student JWT token

# Optional for teacher simulation
export TEST_ADMIN_TOKEN=<admin_jwt_token>
```

Or create a `.env` file in this directory.

## Running

1. Start the backend:
   ```bash
   cd ../backend
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

2. Start Locust:
   ```bash
   locust -f locustfile.py
   ```

3. Open http://localhost:8089

4. Configure:
   - **Host**: `http://localhost:8000`
   - **Number of users**: Start with 50, scale to 500+
   - **Spawn rate**: 10 users/second

## What's Tested

| Endpoint | Weight | Description |
|----------|--------|-------------|
| `POST /exams/{id}/autosave` | 5 | Answer submission (most frequent) |
| `GET /exams/{id}/session` | 3 | Session status check |
| `GET /questions/{id}` | 1 | Question content fetch |
| `POST /exams/{id}/track` | 1 | Anti-cheat tracking |
| `GET /exams/{id}` | 3 | Teacher: exam detail |
| `GET /statistics/...` | 2 | Teacher: analytics |

## Expected Results

- **Target**: 500 concurrent students, < 200ms p95 latency
- **Bottleneck**: autosave endpoint (most frequent write)
- **Scaling**: Celery workers handle IRT/OMR asynchronously
