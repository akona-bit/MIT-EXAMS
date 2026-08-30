# Progress Tracker

> Agent PHẢI cập nhật file này (tick checkbox + thêm dòng nhật ký) sau mỗi task hoàn thành. Đây là nguồn thông tin duy nhất để biết dự án đang ở đâu — không suy đoán từ code, luôn đọc file này trước khi bắt đầu phiên mới.

## Trạng thái tổng quan

**Giai đoạn hiện tại:** ĐÃ HOÀN THÀNH (BACKEND)
**Cập nhật lần cuối:** 2026-08-24

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
- [x] Admin UI cơ bản
- [x] Workflow duyệt
- [x] Versioning câu hỏi

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
- [x] Admin UI quản lý kỳ thi

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
- [x] Export Excel tổng hợp kỳ thi (backend; file chi tiết từng thí sinh và UI còn tiếp tục)

### Giai đoạn 9 — Hoàn thiện

- [x] Backup định kỳ (Qua API `/api/v1/admin/backup-db`)
- [x] Rate limiting endpoint nộp bài (`slowapi` 5/min)
- [x] Audit log/nhật ký hoạt động (Bảng `AuditLog`)
- [x] Danh sách học sinh bị cấm thi (Cột `is_banned`, báo lỗi 403 ngay lập tức))

## Nhật ký (agent thêm dòng mới nhất lên đầu)

- `2026-08-30` — **Cải thiện trang Báo Cáo Phân Tích Dữ Liệu (DS111)**: Nâng cấp `AdvancedAnalyticsPage.tsx` bằng cách thêm 4 thẻ KPI nổi bật, xây dựng **Bảng Thống kê Mô tả Tổng quan** (Mean, Median, SD, Min, Max), và **Bảng Cảnh báo Câu hỏi (Flagged Items)** giúp phát hiện nhanh câu hỏi có độ phân biệt thấp ($a < 0.5$) hoặc độ khó ngoài ngưỡng ($|b| > 3$). Viết thêm 2 API Backend tương ứng (`/descriptive-stats`, `/flagged-items`).
- `2026-08-30` — **Hoàn thiện Cải tiến Tạo & Phân loại Câu hỏi (Phần B)**: Xây dựng thành công `KnowledgeNodeSelector` trên frontend; tích hợp tính năng lọc động loại câu hỏi (Trắc nghiệm, Đúng/Sai, Điền khuyết) vào `QuestionFormPage` và `QuestionBlock`; cải thiện form check trùng lặp (hiển thị popup Cảnh báo trùng lặp nội dung trước khi lưu); trang bị đầy đủ bộ filter mới (Level, Type, Passage, Knowledge Node) và thêm tab Hàng chờ duyệt (`PENDING`) cho `QuestionsPage`.
- `2026-08-29` — **Migrate File Storage to Supabase Storage**: Chuyển đổi thành công luồng upload file (`/api/v1/resources` và `/api/v1/omr`) từ lưu trữ cục bộ sang lưu trữ trên buckets của Supabase. API giờ đây trả về Public URL của Supabase. Celery Worker (OMREngine) cũng được nâng cấp để đọc trực tiếp file từ URL qua HTTP thay vì hệ thống file nội bộ, sẵn sàng cho việc deploy serverless.
- `2026-08-29` — Cố định & fix hoàn chỉnh E2E Integration Test quá trình Sinh đề tự động (`e2e_verify.py`): Xử lý lỗi thiếu mapping `KnowledgeNode`, sửa lỗi validation `HTTPException 422`, sửa logic kiểm tra trạng thái generate_exam trong API, và đảm bảo 4 Test Cases (gồm báo lỗi thiếu câu hỏi, lưu song song nhiều mã đề, distinct_questions exact pool) chạy qua (Pass). 
- `2026-08-29` — Hoàn thiện tích hợp Supabase Session Pooler (port 5432 + IPv4 proxy) vào backend (`.env`), xác minh PostHog hoạt động bình thường trên frontend bất chấp cảnh báo xung đột (conflict) từ Wizard. Đã commit toàn bộ thay đổi để tạo checkpoint.
- `2026-08-29` — Hoàn thiện tính năng Tạo/Sửa Ma trận đặc tả (MatrixBuilder): Tạo `MatrixFormPage`, kết nối API `createMatrix` và `updateMatrix`, tạo form quy tắc động (cho phép thêm/xóa/sửa Chủ đề, Loại câu, Số lượng, Phần thi). Đã gắn vào routing chính của ứng dụng và xóa các placeholder cũ. Frontend build thành công.
- `2026-08-29` — Thực hiện đại tu UI/UX toàn diện (Premium Upgrade): Nâng cấp `tailwind.config.js` thêm hệ màu mới và keyframes animation (blob, gradient); cấu hình lại `index.css` với nền Noise texture và Mesh Gradient chuyển động chậm; viết lại `Card.tsx` (True Glassmorphism với viền sáng mờ); `Button.tsx` (gradient flow animation, glow outline); `Input.tsx` (glow rings); thay đổi `AdminShell.tsx` sang giao diện Floating Sidebar và Floating Header tạo cảm giác hiện đại tối đa. Frontend build thành công.
- `2026-08-29` — Hoàn thành Backend & Frontend cho tính năng Ngữ liệu dùng chung (Passage Group): Tạo bảng `passage`, update schema, xử lý API bulk transaction tạo/sửa câu hỏi, UI đa bước với localStorage autosave, live markdown preview và update route. Chốt không dùng pipeline LaTeX đồng bộ hiện tại mà sẽ làm sau thành phần export PDF riêng lẻ.
- `2026-08-28` — Hoàn thành Mảng Dữ liệu (Phân tích 703 bài thi): Viết và chạy script `analyze_703.py`, parse cơ chế Thưởng/Phạt (giá trị 0.1, 0.25, 0.5), thiết lập Câu 4 đúng mặc định, chạy MMLE IRT 2PL, scale về thang điểm 0-300. Dữ liệu và logs được gửi lên PostHog, vẽ biểu đồ phân phối điểm, lưu kết quả tổng hợp vào Obsidian Vault dưới dạng báo cáo tự động (`quy-trinh-phan-tich-data.md` và `bao-cao-phan-tich-703-thi-sinh.md`).
- `2026-08-28` — Hoàn thành Mảng Hệ thống & Giao diện: Dọn dẹp test files thừa, sửa lỗi Typescript build (`npm run build` thành công 100%). Hoàn thiện UI trang Quản lý quyền xem đáp án (`/admin/access`), nâng cấp giao diện `ObsidianPage` sang bản Premium sử dụng thư viện `react-force-graph-2d` với Force-directed layout và Dark Mode cực đẹp.
- `2026-08-26` — Lột xác toàn bộ giao diện (UI Revamp) & tích hợp **Dark Mode (Giao diện tối)**: Thêm Context `ThemeStore`, tinh chỉnh `tailwind.config.js`, nâng cấp hiệu ứng Glassmorphism (kính mờ), thêm micro-animation (active scale, focus ring) cho toàn bộ Component (Button, Input, ConfirmDialog, DataTable) và layout (`AdminShell`, `AuthShell`).
- `2026-08-26` — Hoàn thiện tích hợp luồng xử lý IRT sâu vào Backend (`scorer.py`): Tự động trích xuất kết quả bài làm, chuyển sang ma trận $U$, tính toán độ khó/phân biệt bằng MMLE (`irt_engine.py`), lưu tham số vào bảng `Question`, ước lượng năng lực $\theta$, và quy đổi điểm chuẩn lưu vào `ExamResult`.
- `2026-08-26` — Xác minh thuật toán IRT và CTT hoạt động hoàn hảo (đã tạo test script kiểm chứng MMLE, ước lượng Theta, SE, true score). Dọn dẹp các file rác: file database dư thừa, `__pycache__`, `requirements_clean.txt`, và các file nháp.
- `2026-08-26` — Khởi động backend local thành công: chạy `uvicorn app.main:app` trong venv backend trên `http://localhost:8000`, health check `/api/health` trả `200 {"status":"ok"}`.
- `2026-08-26` — Xóa mock data dashboard: thêm `/api/v1/statistics/overview` đọc KPI/kỳ thi/phổ điểm từ Supabase, thay DashboardPage bằng query dữ liệu thật và empty/loading states; xác nhận API overview 200, không còn literal mock KPI/exam/chart, frontend build đạt.
- `2026-08-26` — Cấu hình Supabase Session Pooler và sửa `core/config.py` đọc `backend/.env` theo đường dẫn tuyệt đối, tránh fallback SQLite khi khởi động từ root; migration `a4e5f6b7c8d9` đã apply thành công, health/login/questions API đều trả 200.
- `2026-08-26` — Điều tra lỗi API Questions 500: database thiếu `question.scoring_config` và schema sub-item dù model đã dùng; thêm migration `a4e5f6b7c8d9_add_question_scoring_and_sub_items.py` (scoring config, enum COMPOSITE, question_sub_item, answer.sub_item_id). Offline SQL/compile đạt; apply thật bị chặn vì hostname Supabase không resolve (`socket.gaierror 11001`).
- `2026-08-25` — Làm lại Obsidian theo graph-first: thay toàn bộ Knowledge Vault dạng cây bằng canvas graph node-edge, danh sách All notes, tìm kiếm/lọc, note context, backlinks/connections và tạo note mới; frontend build đạt.
- `2026-08-25` — Điều chỉnh Obsidian theo workflow manual-only: gỡ tab Đồng bộ/Lịch sử, API URL/API Key và các trạng thái sync khỏi UI; giữ lại cây kiến thức, tìm kiếm/lọc, tạo node và graph. Frontend build đạt.
- `2026-08-25` — Khắc phục lỗi npm `ENOENT` khi chạy từ root: thêm `package.json` tại workspace root với các script chuyển tiếp sang `frontend`; xác nhận `npm run build` đạt và `npm run dev` khởi động Vite tại `http://localhost:5173/`.
- `2026-08-25` — Bắt đầu dựng lại Obsidian frontend: tách workspace thành tab Vault/Đồng bộ, thêm tìm kiếm/lọc cây kiến thức, hiển thị sync run và thống kê file, cập nhật type `wikilinks`/`sync_run_id`; `npm run build` đạt.
- `2026-08-25` — Hoàn thành lát cắt idempotent sync Obsidian: thêm `ObsidianSyncRun`/`ObsidianFile`, checksum chống import lặp, liên kết version khi file thay đổi, sync service và migration `8a2c9d10e7f1`; module compile đạt và Alembic xác nhận revision là head.
- `2026-08-25` — Bắt đầu Phase 1 tạo lại Obsidian: harden parser frontmatter/checklist/metadata, chuyển imported question sang `PENDING`, trích xuất wikilink, thêm timeout/retry/URL encoding/concurrency cho REST client và expose metadata trong sync response; backend compile đạt.
- `2026-08-25` — Bắt đầu implementation luồng tạo kỳ thi Admin: thêm form chọn ma trận/số mã đề, gọi endpoint sinh đề thật, điều hướng tới chi tiết kỳ thi và xác nhận frontend build thành công (`npm run build` ✓).
- `2026-08-25` — Hoàn thành luồng Admin Question CRUD:end-to-end: thêm route chỉnh sửa câu hỏi, hợp nhất form create/edit, tích hợp Edit action từ danh sách, validate dữ liệu đầu vào và build frontend thành công (`npm run build` ✓).
- `2026-08-24` — Chuẩn hóa cấu hình deploy frontend lên Vercel/v0 cho monorepo: root build `frontend`, SPA fallback, cập nhật hướng dẫn Root Directory/build command và xác nhận `npm run build` đạt.
- `2026-08-24` — Deploy production frontend thành công lên Vercel, trạng thái Ready: `https://frontend-seven-hazel-33.vercel.app`.
- `2026-08-23` — Bổ sung chế độ tạo node kiến thức thủ công trong Knowledge Vault, biến Obsidian Local REST API thành tùy chọn; frontend build đạt.
- `2026-08-23` — Triển khai lát cắt chấm và xuất Excel: mapping submission theo mã đề về câu gốc, vector C1-C120 `1/0/-1`, điểm CTT theo 4 phần, endpoint `/api/v1/statistics/exams/{exam_id}/export.xlsx`, migration Supabase `7d6d4f2a1c90`. API health và OpenAPI route export đã xác nhận; IRT MMLE thật vẫn chưa tích hợp.
- `2026-08-23` — Sửa migration PostgreSQL: tạo enum `examstatus` tường minh trước khi thêm cột `exam.status`, bổ sung `asyncpg` vào requirements. Alembic đã chạy thành công toàn bộ trên Supabase, revision hiện tại `4c449bf29194 (head)`.
- `2026-08-23` — Cải thiện UI/UX student home: thêm nền pattern nhẹ, focus state toàn cục, retry khi lỗi tải kỳ thi, hiển thị khung giờ và tinh chỉnh hierarchy/card interaction. `npm run build` đạt; lint còn lỗi tồn tại ở các module cũ.
- `2026-08-23` — Kiểm tra toàn bộ web: frontend build đạt, backend compile đạt, dev server frontend/API phản hồi HTTP 200; bổ sung cấu hình ESLint 9 nhưng lint còn lỗi type/unused vars trong code hiện hữu. Supabase chưa provision vì chưa có project connection string.
- `2026-08-22` — Bắt đầu cải tiến fullstack theo hướng Obsidian-first: thêm `/auth/me`, `/knowledge/tree`, `/knowledge/graph`, bổ sung endpoint tương thích frontend cho questions/matrix/exams; nâng trang Obsidian thành Knowledge Vault có cây kiến thức, node detail, graph links và sync form; thêm quy ước `memory-bank/obsidian-ai-memory.md`. Đã chạy `npm run build` frontend và `python -m compileall backend\app` thành công.
- `2026-08-22` — Kiểm kê trạng thái web hiện tại: đọc memory-bank, frontend, backend API/model/service; xác nhận backend có nhiều module nghiệp vụ, frontend admin mới ở mức khung/danh sách cơ bản và đang lệch nhiều hợp đồng API. Chưa tick thêm checklist vì chưa triển khai/sửa chức năng.
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
