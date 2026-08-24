# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**MIT EXAMS** — nền tảng quản lý ngân hàng câu hỏi và tổ chức thi trắc nghiệm ĐGNL (120 câu / 4 phần / thang 0-300/phần). Tương tự Azota.vn nhưng chuyên biệt cho dạng ĐGNL.

**Stack:**
- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + Alembic + Celery + Redis
- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS + TanStack Query + axios
- **DB:** Mặc định SQLite (`./mit_exams.db`); production dùng Postgres (xem `docker-compose.yml`)
- **Python 3.11+**, **Node 18+**

## Context Loading Order (BẮT BUỘC theo AGENTS.md)

Mọi agent phải đọc theo thứ tự trước khi làm việc:
1. `memory-bank/project-overview.md` — phạm vi & mục tiêu
2. `memory-bank/architecture.md` — kiến trúc + bảng đối chiếu ERD ↔ table names
3. `memory-bank/build-plan.md` + `memory-bank/progress-tracker.md` — đang ở giai đoạn nào
4. `memory-bank/code-standards.md` — quy ước code
5. Khi làm UI: thêm `memory-bank/ui-tokens.md`, `ui-rules.md`, `ui-registry.md`
6. Khi cần thư viện cụ thể: `memory-bank/library-docs.md`

Đặc biệt **luôn đọc `memory-bank/progress-tracker.md` đầu phiên** — đây là nguồn duy nhất cho biết dự án đang ở đâu. Sau khi hoàn thành task, **cập nhật file này** (tick checkbox + ghi nhật ký ngày).

## Non-Negotiable Rules

1. **Không bao giờ ghi đè câu hỏi đã dùng trong đề thi đã tổ chức** — phải tạo version mới (xem `code-standards.md` mục Versioning; logic đã có trong `api/v1/questions.py` PUT endpoint).
2. **Không chạy MMLE/IRT đồng bộ trong request API** — luôn qua Celery task, trả `task_id` để client poll.
3. **Vị trí câu hỏi trong đề (mã đề) ≠ ID câu hỏi gốc** — luôn map qua `ExamFormQuestion`/`ExamFormAnswer`, không hard-code thứ tự 1-120 khi thao tác với ngân hàng câu hỏi.
4. **Ngưỡng N ≥ 200-300 lượt làm** mới được dùng kết quả MMLE-IRT làm chính thức; dưới ngưỡng dùng CTT.
5. **Stack phải free/open-source** — không thêm dependency có phí mà không hỏi trước.
6. **Domain terms:** UI/comment nghiệp vụ tiếng Việt ("Mã đề", "SBD", "Ma trận đặc tả"...). **Code identifiers (biến, hàm, bảng DB, API route) tiếng Anh**.
7. **Không sửa thuật toán** trong `irt.py`/`ctt.py`/`item_plot.py` — chỉ viết wrapper. Khi tích hợp IRT/CTT, bọc hàm trong `services/grading/`, gọi từ Celery task.

## Skills tự động kích hoạt

`.agents/skills/` có 4 skill chuyên biệt — tự trigger khi làm task liên quan (semantic triggering):
- `sinh-de-tu-dong` — sinh đề theo ma trận + xáo mã đề
- `cham-diem-ctt-irt` — chấm CTT/IRT 2PL, tích hợp `irt.py`/`ctt.py`
- `omr-reader` — đọc phiếu OMR bằng OpenCV
- `bao-mat-thi-online` — chống gian lận (giám sát tab, copy-paste, 1 thiết bị/phiên, watermark SBD)

## Architecture (big picture)

```
FastAPI (app/main.py) ── JWT auth (core/security.py) ── RBAC via api/dependencies.py
   │
   ├── Routers (api/v1/): auth, knowledge, questions, matrix, exams, grading, omr, statistics, admin, obsidian
   │
   ├── Services (services/): generator (sinh đề), exam_session (autosave/submit/timer),
   │   audit, obsidian_parser, obsidian_api_client
   │
   ├── Grading engine (services/grading/):
   │   ├── ctt.py — CTT (độ khó, độ phân biệt, độ nhiễu) — pandas/numpy
   │   ├── irt.py — IRT 2PL (MMLE, Newton-Raphson, Gauss-Hermite K=81, EAP theta, chi-square fit)
   │   ├── item_plot.py — chamDiem() mapping vị trí→câu gốc, tach_phan() tách 4 phần thi
   │   └── scorer.py — Celery task wrapper, grade_submission_ctt (async, map qua ExamFormQuestion)
   │
   ├── OMR (services/omr/): pipeline.py (OMREngine, OpenCV), tasks.py (Celery worker)
   │
   └── Models (models/): Base (auto-naming via camel_to_snake), User/Role, Question/Answer/KnowledgeNode/Resource,
       Matrix/MatrixRule, Exam/ExamForm/ExamFormQuestion/ExamFormAnswer/ExamParticipant/ExamSubmission,
       ExamTrackingLog, ExamResult/IrtTask, OmrJob/OmrSheet, AuditLog

Celery worker (worker.py, broker = Redis)
   └── Task modules: app.services.grading.scorer, app.services.omr.tasks
```

**Luồng sinh đề (services/generator.py):**
1. `generate_original_exam()`: chọn câu APPROVED theo `MatrixRule` → tạo `ExamForm(code="ORIGINAL", is_original=True)` với vị trí theo 4 phần (1-30, 31-60, 61-90, 91-120).
2. `generate_shuffled_forms()`: xáo câu **trong từng phần** (giữ cấu trúc 30-30-30-30) + xáo đáp án → tạo N mã đề (101, 102, ...).

**Luồng thi online (services/exam_session.py):**
- `assign_participants()` tạo danh sách.
- `get_or_assign_exam_form()` random gán mã đề (loại trừ original) khi thí sinh start.
- Timer tính từ `participant.start_time + duration_minutes`, có giới hạn bởi `exam.end_time`.
- `is_banned = True` → trả 403 ngay.
- Autosave lưu `ExamSubmissionAnswer`, submit set `ParticipantStatus.SUBMITTED`.

**Grading flow:**
1. `grade_submission_ctt()` (sync) chấm ngay sau submit — đếm đúng theo `part` (1-4).
2. `run_irt_calibration_task` (Celery, async) chạy MMLE 2PL khi đủ N≥200-300 — hiện tại là placeholder (`scorer.py:run_irt_calibration_task`), cần tích hợp thật với `irt.mmle()`.

**Obsidian sync (memory-bank/obsidian-ai-memory.md):**
- Quy ước frontmatter: `type: question`, `knowledge_node: "Topic/Concept/Skill"`, `level`, `question_type`.
- Đáp án dùng checklist markdown: `- [ ] A`, `- [x] B`...
- `services/obsidian_parser.py` parse + import thành `Question` (status = APPROVED).
- API: `GET /api/v1/knowledge/tree`, `GET /api/v1/knowledge/graph`, `POST /api/v1/obsidian/sync-local-api`.

## Conventions ngôn ngữ đặc biệt

- **4 phần thi:** TV (1-30), TA (31-60), Toán (61-90), TDKH (91-120) — constant này xuất hiện trong `generator.py:current_positions`, `item_plot.py:tach_phan`, `ExamFormQuestion.part`.
- **Định dạng đáp án CSV cũ:** `STT_gốc-Đáp_án` (vd `Cau118 = 114-C` nghĩa câu gốc 118 ở vị trí 114 mã đề, đáp án C) — xem `item_plot.py:chamDiem` để parse logic này.
- **Giá trị chấm câu:** `1`=đúng, `0`=sai, `-1`=bỏ trống. **Không** đổi thành `null`/`None` — nhiều hàm CTT/IRT phụ thuộc `-1`.

## Common Commands

### Backend

```bash
# Activate venv (đã có sẵn backend/venv)
cd backend
# Source venv:
#   Windows PowerShell: .\venv\Scripts\Activate.ps1
#   Git Bash/Linux: source venv/bin/activate

# Run API (default port 8000, SQLite mit_exams.db)
uvicorn app.main:app --reload

# Run Celery worker
celery -A app.worker.celery_app worker --loglevel=info

# Seed roles (chạy 1 lần)
python -m app.db.seed

# Seed questions demo
python -m app.db.seed_questions

# Alembic migrations
alembic revision --autogenerate -m "..."
alembic upgrade head

# Compile check
python -m compileall app

# Test (pytest + pytest-asyncio — chưa có tests/, sẽ tạo theo code-standards.md)
pytest -v
pytest tests/services/test_generator.py::test_name  # single test
```

### Frontend

```bash
cd frontend
npm install                  # cài dependencies
npm run dev                  # vite dev server (port 5173)
npm run build                # tsc -b && vite build (typecheck + build)
npm run lint                 # eslint
npm run preview              # preview production build
```

### Docker (Postgres + Redis)

```bash
docker compose up -d         # chỉ chạy db + redis
```

Backend mặc định dùng SQLite. Để chuyển sang Postgres: set `DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/mit_exams` trong `.env`.

### Environment

`.env.example` chứa `POSTGRES_*`, `REDIS_URL`, `SECRET_KEY`. Copy sang `.env` và đổi `SECRET_KEY` trước khi chạy thật. Default `SECRET_KEY` trong `core/config.py` chỉ dùng cho dev.

## Frontend Architecture

```
src/
├── main.tsx                 # QueryClient + StrictMode wrapper
├── App.tsx                  # Routes + ProtectedRoute (RBAC by role.name)
├── stores/authStore.tsx     # AuthContext, useAuth() — lưu token ở localStorage, fetch /auth/me
├── api/                     # axios client + per-resource functions
│   ├── client.ts            # Axios instance, interceptor gắn Bearer, redirect /login khi 401
│   ├── auth.ts              # login (form-urlencoded), register, getMe
│   ├── questions.ts, matrix.ts, exams.ts, knowledge.ts, obsidian.ts
├── types/index.ts           # Toàn bộ interfaces (User, Question, Matrix, Exam, ...)
├── components/
│   ├── ui/                  # Button, Input, DataTable, ConfirmDialog
│   └── layout/              # AuthShell (gradient bg), AdminShell (sidebar + topbar)
├── pages/
│   ├── auth/                # LoginPage, RegisterPage
│   └── admin/               # Dashboard, Questions, QuestionForm, Matrix, Exams, ExamDetail, Obsidian
```

**Trạng thái frontend (theo progress-tracker.md 2026-08-22):**
- ✅ Admin shell + auth flow hoàn chỉnh
- ✅ Các trang list cơ bản (questions, matrix, exams, knowledge vault từ Obsidian)
- ❌ **Student exam-taking UI chưa có** — `App.tsx` chỉ có placeholder `<div>Student Home Placeholder</div>`. Cần: `StudentExamShell`, `QuestionNavGrid`, autosave offline (IndexedDB), timer đồng bộ server, watermark SBD, giám sát tab exit. Xem skill `bao-mat-thi-online` + `ui-rules.md`.
- ❌ QuestionEditor/MatrixBuilder/ResourceUploader trong `ui-registry.md` chưa có.

**API client pattern:** Tất cả API functions trả về `data` trực tiếp (đã unwrap axios response). Pagination trả `{items, total, page, size}`.

**Tailwind tokens** (xem `ui-tokens.md` + `tailwind.config.js`): dùng `primary-*`, `neutral-*`, `success-500`, `danger-500`, `warning-500`, `info-500`. **Không hard-code màu** — bổ sung vào tokens trước.

## Testing Strategy

Hiện tại **chưa có `backend/tests/`** — cần tạo. Theo `code-standards.md`: mỗi service/module mới bắt buộc có `pytest` test cho happy path + 1 edge case.

## Common Pitfalls

- `obsidian_api_client.py:list_vault_files()` đang là stub — chỉ `get_all_markdown_contents()` hoạt động. Không sửa trừ khi cần.
- `scorer.py:run_irt_calibration_task()` là Celery placeholder, **không gọi `irt.mmle()` thật** — khi đủ dữ liệu cần implement phần này (xem skill `cham-diem-ctt-irt`).
- `omr/pipeline.py:OMREngine.process()` dùng random — chỉ là simulation. Production cần OpenCV template matching thật (xem skill `omr-reader`).
- `admin.py:backup_database()` chỉ backup file `mit_exams.db` cứng — không hoạt động khi dùng Postgres.
- Frontend `ui-registry.md`: hầu hết components ở trạng thái "Chưa tạo". Trước khi tạo mới, kiểm tra file này.
- `vite-env.d.ts` trống — frontend đọc `VITE_API_URL` từ env (default `http://localhost:8000`). Tạo `frontend/.env` nếu cần đổi.
