# Progress Tracker

> Agent PHẢI cập nhật file này (tick checkbox + thêm dòng nhật ký) sau mỗi task hoàn thành. Đây là nguồn thông tin duy nhất để biết dự án đang ở đâu — không suy đoán từ code, luôn đọc file này trước khi bắt đầu phiên mới.

## Trạng thái tổng quan

**Giai đoạn hiện tại:** ĐÃ HOÀN THÀNH TOÀN BỘ (BACKEND & FRONTEND) + UI REDESIGN
**Cập nhật lần cuối:** 2026-09-04

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

- [x] Giao diện phòng thi (`StudentExamShell`, `QuestionNavGrid`) — 100% hoàn thiện (Tất cả định dạng câu hỏi ✅)
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
- [x] **Hybrid 2 lớp OMR** (2026-09-04):
  - [x] Lớp 1 — OpenCV: marker detection, perspective transform, auto-threshold từ hàng Type, đọc SBD/Mã đề/120 câu
  - [x] Lớp 2 — Gemini Vision: chỉ xử lý câu needs_review, crop ảnh nhỏ, prompt JSON
  - [x] Calibration tool: auto-detect bubble coordinates từ ảnh phiếu trống
  - [x] Celery tasks: `process_omr_sheet_task`, `process_omr_batch_task`, `confirm_omr_sheet_task`
  - [x] API endpoints: upload, job status, sheet detail, review, reject, calibrate
  - [x] Unit tests: marker detection, perspective transform, fill ratio, threshold calibration

### Giai đoạn 8 — Thống kê & Dashboard

- [x] KPI cards + phổ điểm
- [x] Phân tích câu hỏi (cảnh báo misfit)
- [x] So sánh chất lượng đề
- [x] Export Excel tổng hợp kỳ thi & Xuất đề LaTeX offline

### Giai đoạn 9 — Hoàn thiện

- `2026-09-01` — **Ổn định môi trường test backend**: venv cũ (`backend/venv`) đã bị xóa khỏi máy — chuyển sang chạy test bằng Python 3.11 global (`C:\...\Python311\python.exe`, đã có đủ fastapi/sqlalchemy/pytest). Fix lỗi mapper "Passage failed to locate a name" xảy ra khi chạy nhiều file test cùng lúc (configure_mappers fail ở file chạy trước sẽ poison cả process): thêm `backend/tests/conftest.py` import toàn bộ model module (passage/omr/obsidian/system/audit/user/question/exam/grading) ngay từ đầu — đây là fix gốc, các import phòng thủ trong từng file test giữ nguyên để chạy standalone vẫn ổn. Xác nhận 29/29 test pass (unit_db_mocking + exam_result_service + happy_paths + suspend_autosave + grading_scorer).

- [x] Backup định kỳ (Qua API `/api/v1/admin/backup-db`)
- [x] Rate limiting endpoint nộp bài (`slowapi` 5/min)
- [x] Audit log/nhật ký hoạt động (Bảng `AuditLog`)
- [x] Danh sách học sinh bị cấm thi (Cột `is_banned`, báo lỗi 403 ngay lập tức)
- [x] Hệ thống Feedback (Góp ý/Báo lỗi)

## Nhật ký (agent thêm dòng mới nhất lên đầu)

- `2026-09-04` — **Đồng bộ Logic Ma trận & Cây Tri thức**: 
  - [x] Sửa đổi `KnowledgeService`: Tính tổng số câu hỏi gộp (inclusive) từ các node con, cháu để hiển thị chính xác tổng lượng câu hỏi cho Topic/Concept.
  - [x] Nâng cấp `generator.py`: Thuật toán sinh đề giờ đây sẽ lấy đệ quy toàn bộ câu hỏi từ tất cả các Kỹ năng con (descendant leaves) nếu Ma trận chỉ định một Chủ đề (Topic/Concept). Khắc phục lỗi sinh đề không tìm thấy câu hỏi do tag Kỹ năng vi mô.
  - [x] Frontend `MatrixFormPage.tsx`: Thay thế dropdown phẳng bằng `MatrixNodeSelector` - kế thừa giao diện tìm kiếm dạng cây cha-con từ trang tạo Câu hỏi, giúp giao diện tạo Ma trận trở nên đồng nhất và trực quan.

- `2026-09-04` — **Fix Bug & UI Phân loại câu hỏi**: 
  - [x] Thêm API endpoint `POST /ai-suggest-tags` để kết nối AI lấy gợi ý Kỹ năng/Môn học.
  - [x] Cập nhật mapping `QuestionResponse` cho endpoint GET `get_questions` để fix lỗi mất `@property primary_knowledge_node_id` dẫn đến hiển thị `Node #undefined` ở UI.
  - [x] Thiết kế lại `KnowledgeNodeSelector` & `QuestionFormPage`: gộp Subject và Selector thành một block, chuyển đổi thanh search thành combobox thanh lịch, và di dời nút Phân tích AI sang một khối nổi bật hơn với hiệu ứng gradient.

- `2026-09-04` — **Cải thiện UI/UX Toàn diện (Extreme Premium Upgrade)**:
  - [x] Tích hợp `framer-motion` cho toàn bộ UI component cốt lõi.
  - [x] Tạo `PageTransition` component bọc ngoài các trang Admin/Student để có hiệu ứng fade-in mượt mà thay vì nhảy trang giật cục.
  - [x] Nâng cấp `Button.tsx` (`<motion.button>`) thêm tương tác nảy (tap scale) và `Card.tsx` (`<motion.div>`) thêm floating hover & inner glow.
  - [x] Tinh chỉnh CSS hệ thống (`index.css`): Bổ sung SVG Noise/Grain Texture 5% opacity hoà trộn vào mesh gradient background để tạo hiệu ứng frosted glass/Apple-style cao cấp.
  - [x] Áp dụng animation trượt tuần tự (staggered entrance) cho các thẻ bài thi tại trang chủ Học sinh (`StudentHomePage.tsx`).

- `2026-09-04` — **Dọn dẹp hệ thống & Đồng bộ Giao diện**:
  - [x] Xóa bỏ 4 trang Prototype tĩnh/lỗi (`StudentComparePage`, `StudentDetailPage`, `ExamComparePage`, `FraudDetectionPage`) do không còn dùng hoặc thiếu API hỗ trợ.
  - [x] Xóa sạch các route chết trong `App.tsx` và sidebar trong `AdminShell.tsx`.
  - [x] Kiểm tra và xác nhận đồng bộ giao diện Premium (Gradient Header, Glassmorphism Card, Glow Button) trên toàn bộ hệ thống Admin. Sửa nhỏ một vài Header chưa áp dụng class `text-gradient`.

- `2026-09-04` — **Tích hợp AI chuyên sâu vào Tạo Câu hỏi & Sinh Ma trận**:
  - [x] Backend: Thêm endpoint `/api/v1/matrix/ai-generate` gọi Gemini tạo quy tắc ma trận từ prompt, bổ sung schema cho Request/Response. Nâng cấp service `suggest_question_tags` để auto-map tên chủ đề AI sinh ra với DB `node_id`.
  - [x] Frontend: Sửa `QuestionFormPage`, gỡ bỏ auto-suggest debounced gây phiền toái, thêm nút "🪄 Phân tích AI" chủ động. Xử lý logic check `node_id` chặt chẽ.
  - [x] Frontend: Cập nhật `MatrixFormPage`, tạo Modal "Sinh ma trận bằng AI", tích hợp gọi API để render hàng loạt rule (mức độ, dạng câu, số lượng) thẳng vào form.

- `2026-09-04` — **Fix StudentDetailPage**:
  - [x] Xóa mock data `mockHistory`, thay bằng `[]` + empty state với Clock icon "Chưa có lịch sử làm bài".
  - [x] Thêm loading spinner state, entrance animation (`animate-in fade-in slide-in-from-bottom-4`).
  - [x] Fix `user?.registration_number` → `user?.username` (trường không tồn tại trên User type).
  - [x] Xóa import `useEffect` không dùng, bỏ comment TODO.

- `2026-09-04` — **Xây lại "Quản lý Thí sinh" theo database (bỏ demo CSV)**:
  - Vấn đề: trang cũ đọc CSV demo (`data/raw_students.csv`) với cột cố định "Toán (IRT)/TDKH (IRT)", không theo DB, không linh hoạt theo kỳ thi/mã đề; frontend dùng raw `fetch` localhost không kèm token; endpoint `/analytics/*` không có auth.
  - [x] Backend: thêm `GET /admin/exams/{exam_id}/participants-detail` (ADMIN/TEACHER) — join ExamParticipant + User + ExamForm (mã đề) + ExamSubmission + ExamResult; trả `sections` (các phần thi thực tế của kỳ thi, suy từ ExamFormQuestion.part — không hard-code 4 phần), filter theo form_code/status/search (SBD, tên, email), batch-load ExamResult tránh N+1.
  - [x] Frontend: xây lại `StudentManagementPage.tsx` — chọn kỳ thi → KPI (tổng/đã nộp/đang thi/bị cấm) + bảng thí sinh với cột điểm động theo từng phần của đề, mã đề badge, trạng thái (Chưa bắt đầu/Đang thi/Đã nộp/Bị đình chỉ), tổng thô CTT, điểm thực IRT (chỉ hiện khi score_method=IRT, đúng ngưỡng N≥200), thời gian nộp; filter mã đề + trạng thái + search debounce.
  - [x] API client: `getExamParticipants` trong `api/admin.ts`.
  - Ghi chú: trang so sánh thí sinh cũ (`/admin/students/compare`, `/admin/students/:id`) vẫn dựa CSV demo — cần xây lại sau nếu muốn; endpoint `/analytics/*` (class-summary, students, item-analysis) vẫn chưa có auth.

- `2026-09-04` — **Audit Sidebar Admin + bổ sung UI còn thiếu (OMR UI, AI Review Queue, Staff Edit)**:
  - [x] Audit 6 điểm sidebar: (1) Quản lý user/role đã có backend (`/admin/staff` CRUD, `/users/invite`) + UI `/admin/access` nhưng bị đặt sai tên "Quyền xem đáp án"; (2) Duyệt câu hỏi đã đủ (tab PENDING + approve/reject); (3) OMR backend xong nhưng 0 UI; (4) AI review chỉ có modal per-question, thiếu queue; (5) Settings đã đủ; (6) Notifications chưa tồn tại ở bất kỳ tầng nào (chưa làm, chờ quyết định product).
  - [x] Backend: thêm `GET /questions/ai-review-queue` (filter theo review_status, phân trang, join Question) — đặt trước route `/{question_id}` để tránh path shadowing.
  - [x] Frontend: trang `OmrPage.tsx` (`/admin/omr`) — chọn kỳ thi, upload nhiều ảnh phiếu, poll job realtime, bảng sheets với badge trạng thái, nút "Xác nhận & chấm" cho sheet NEEDS_REVIEW.
  - [x] Frontend: trang `AiReviewQueuePage.tsx` (`/admin/ai-review`) — 4 tab trạng thái, tái sử dụng `AiReviewModal` theo question_id, refresh queue sau khi duyệt.
  - [x] Frontend: `AccessControlPage` StaffTab — thêm modal Sửa nhân sự (đổi role TEACHER/MODERATOR/ADMIN, bật/tắt is_active) dùng `PUT /admin/staff/{id}` có sẵn.
  - [x] Sidebar: đổi label "Quyền xem đáp án" → "Người dùng & Phân quyền"; thêm "Chấm bài (OMR)" vào Vận hành Thi cử và "Duyệt phân tích AI" vào Nội dung & Kiến thức.

- `2026-09-04` — **UI Redesign toàn diện (5 phase)**:
  - [x] **Phase 1 — Nền tảng**: Tạo 5 UI components mới (`Select`, `Textarea`, `Tabs`, `Toast`, `Alert`). Backend: `Notification` model + 5 API endpoints (list, unread-count, read, read-all, delete, send). Frontend: `notificationStore` (React context + polling 30s), `NotificationBell` (bell icon + unread badge + dropdown + detail modal). ToastProvider integrated. Bell thêm vào AdminShell header + StudentHomePage header.
  - [x] **Phase 2 — Replace alert/confirm**: Thay thế 52 `alert()` → `toast.success/error/warning/info` trên 14 files. Thay 3 `window.confirm()` → `<ConfirmDialog>` trên 3 files (QuestionFormPage, KnowledgePage, ResourcesPage).
  - [x] **Phase 3 — Fix mismatches**: `resources.ts` thêm `/api/v1/` prefix. TeacherAnalyticsPage + StudentAnalyticsPage fix hardcoded `localhost:8000` → api client. Thêm `deleteExam`, `updateExam`, `completeExam` API functions.
  - [x] **Phase 4 — UI polish**: Tạo `StudentShell` layout (logo, bell, user info, logout). Wrap student routes. Simplify student page headers.
  - [x] **Phase 5 — Admin notifications**: Tạo `AdminNotificationsPage` (gửi thông báo user/role/all, lịch sử, đánh dấu đã đọc). Route `/admin/notifications` + nav item.
  - Toast fix: `toast` export là constant object (không phải function) để hỗ trợ `toast.error()` syntax.
  - Backend tests: 74/74 pass. Frontend: tất cả toast type errors resolved.

- `2026-09-04` — **Cải thiện UI/UX toàn website (6 phase)**:
  - [x] **Phase 1 — Quick Fixes**: Fix font conflict (tailwind.config.js统一 Plus Jakarta Sans), fix NotificationBell delete button (thêm `group` class), ẩn FPS counter (dev mode only), consolidate z-index scale trong tailwind config.
  - [x] **Phase 2 — Loading & Error States**: Tạo `PageSkeleton`, `ErrorState`, `EmptyState` components mới.
  - [x] **Phase 3 — Error Boundary**: Tạo `ErrorBoundary` class component, wrap `<AppRoutes />` để crash không white-screen toàn app.
  - [x] **Phase 4 — Admin Pages Polish**: AccessControlPage (Badge/Button/Skeleton/EmptyState + toast.error cho silent catches), AdminFeedbacksPage (Badge/Select/Skeleton + entrance animation), ExamsPage (search functionality + Button styling), MatrixPage (emptyMessage + ConfirmDialog thay confirm()), PassagesPage (Badge thay raw span), AdminNotificationsPage (page title consistency + skeleton loading + empty state + entrance animation), QuestionsPage (Select component thay raw select).
  - [x] **Phase 5 — Student Pages**: StudentDetailPage (xoá mock data, thêm loading/empty state, fix User type), StudentComparePage (xoá mock data, thêm empty state), StudentHomePage (skeleton cards loading, proper empty/error states).
  - [x] **Phase 6 — Button success variant**: Thêm `success` variant cho Button component.
  - Backend tests: 74/74 pass. Frontend: tất cả new errors resolved, chỉ còn pre-existing unused imports.

- `2026-09-04` — **Xây dựng Module OMR Hybrid 2 Lớp (OpenCV + Gemini Vision)**:
  - [x] Tạo cấu trúc `backend/app/services/omr/` với các module: `layout_config.py`, `layers/opencv_layer.py`, `layers/gemini_layer.py`, `hybrid_omr.py`, `calibration.py`, `tasks.py`
  - [x] **Lớp 1 OpenCV**: Detect 4 marker góc → perspective transform → tự động threshold từ hàng Type (calibration pattern) → đọc SBD (6 cột x 10 hàng), Mã đề (3 cột x 10 hàng), 120 câu (5 khối x 24 câu x 4 lựa chọn). Logic quyết định: 0 ô → trống, 1 ô → chọn + tính gap, ≥2 ô → multi-mark needs_review
  - [x] **Lớp 2 Gemini Vision**: Chỉ xử lý câu needs_review từ Lớp 1. Crop ảnh nhỏ (không gửi cả trang) để tiết kiệm token. Prompt trả JSON `{trang_thai, dap_an}`. Bắt buộc `nhieu_dap_an` khi gap không rõ ràng. Backend chỉ lưu khi `trang_thai=hop_le`
  - [x] **Calibration tool**: Auto-detect bubble contours từ ảnh phiếu trống, cluster thành SBD/Mã đề/Questions/Type, xuất JSON config
  - [x] **Celery tasks**: `process_omr_sheet_task` (single), `process_omr_batch_task` (batch), `confirm_omr_sheet_task` (confirm sau review)
  - [x] **API endpoints**: `POST /upload`, `GET /jobs/{id}`, `GET /sheets/{id}`, `POST /sheets/{id}/review`, `POST /sheets/{id}/reject`, `POST /calibrate`
  - [x] **Unit tests**: 30+ test cases cho marker detection, perspective transform, fill ratio, threshold calibration, question read, SBD read, edge cases

- `2026-09-03` — **Triển khai AI Analysis & Mở rộng Matrix Generator**:
  - [x] **Phase 1-2**: Xây dựng bảng `ai_analysis_cache` và tích hợp Gemini 1.5 Pro API thông qua endpoint `POST /questions/{id}/analyze`, ép kiểu trả về JSON chứa attributes sư phạm (concepts, skills, cognitive_level).
  - [x] **Phase 3**: Mở rộng `matrix_rule_group` với trường `group_mode` (`ATOMIC`, `FLEXIBLE`, `OPTIONAL`). Cập nhật `exam_matrix_generator.py` để xử lý logic best-effort cho các chế độ nới lỏng mà không trigger lỗi `MATRIX_UNSATISFIABLE`.
  - [x] **Phase 4**: Thiết kế hệ thống AI Analysis Cache & Human Review workflow
  - [x] **Phase 5**: Xây dựng Semantic Similarity Search (Vector search) để cảnh báo trùng lặp
  - [x] **Phase 6**: Xây dựng Knowledge Graph Visualization
  - [x] **Phase 7**: General system stability and UI polish (Đã xác minh toàn bộ components hoạt động trơn tru)

- `2026-09-03` — **Thiết lập nâng cao Row Level Security (RLS)**: Đã tạo script `rls_policies.sql` hoàn chỉnh áp dụng policies chuyên sâu dựa theo Role (`ADMIN`, `TEACHER`, `MODERATOR`, `STUDENT`), kết hợp ẩn câu hỏi theo trạng thái bài thi `IN_PROGRESS`. Xây dựng các Helper Functions trên Postgres (như `current_user_role_name`) và Database Triggers để ngăn thí sinh chỉnh sửa các cột nhạy cảm (`is_active`, `is_banned`). Hướng dẫn Celery worker bypass RLS.

- `2026-09-03` — **Chuyển đổi Quên Mật Khẩu sang OTP & Hệ thống Feedback**: 
  - [x] Chuyển đổi tính năng quên mật khẩu từ dạng link thành mã OTP (3 bước: gửi OTP, xác thực, đổi mật khẩu).
  - [x] Thêm cooldown 60s giữa các lần gửi OTP.
  - [x] Cải thiện giao diện email thông báo để thân thiện và chuyên nghiệp hơn (Premium UI cho email.py), tích hợp nhắc nhớ hỗ trợ Discord.
  - [x] Xây dựng hệ thống Góp ý/Báo lỗi (Feedback System): Model `Feedback`, API, Component `StudentFeedbackModal` (tích hợp `StudentHomePage` & `StudentExamShell`), và trang quản lý cho Admin.

- `2026-09-02` — **Hoàn thiện Tính năng Đăng nhập & Xác thực**: Tích hợp luồng Supabase OTP cho chức năng Guest Login và Forgot Password. Bổ sung `registration_number` (Số báo danh SBD - 6 số tự động) vào `User` model, cập nhật `dependencies.py` để auto-generate SBD khi người dùng được tạo. Thay thế toàn bộ `LoginPage.tsx` hỗ trợ đăng nhập qua SBD hoặc Email và lựa chọn Mật khẩu hoặc OTP. Cập nhật `AccessControlPage.tsx` và `admin.py` hỗ trợ tính năng mời hàng loạt (multi-select/invite qua mảng emails). Đã verify frontend build thành công.

- `2026-09-02` — **Hoàn thiện tính năng Mời người dùng & Chế độ Bảo trì**: Cập nhật `AccessControlPage` để Admin có thể mời người dùng mới bằng Gmail thông qua hệ thống `invite_user_by_email` của Supabase Auth (bao gồm chọn phân quyền: Học sinh, Giáo viên, Admin). Xây dựng `SystemSettingsPage` cho phép Admin bật/tắt **Chế độ bảo trì** theo các mức độ (toàn bộ, phòng thi, kết quả). Chế độ bảo trì tự động chặn truy cập của học sinh và hiển thị màn hình `MaintenanceScreen`, nhưng hoàn toàn không ảnh hưởng đến Giáo viên và Admin để đảm bảo vận hành.

- `2026-09-02` — **Hoàn thiện API Ngữ liệu & Phân tích chuyên sâu (Analytics)**: Sửa API `passages.py` hỗ trợ fetch theo `id` (integer) hoặc `public_code` để tương thích hoàn toàn với frontend. Đã triển khai đầy đủ 5 API báo cáo cho trang Phân tích chuyên sâu (`/boxplots`, `/descriptive-stats`, `/penalty-vs-irt`, `/leaderboard`, và đổi `/misfit-items` thành `/flagged-items` với định dạng dữ liệu chuẩn mapping sang frontend). Web có thể render biểu đồ và phân tích từ dữ liệu Supabase mà không bị 404.

- `2026-09-02` — **Cleanup Database Supabase**: Xóa 9 bảng không cần thiết (obsidian_file, obsidian_sync_run, omr_sheet, omr_job, exam_tracking_log, audit_log, question_embedding, item_analysis_result, exam_generation_run). DELETE sạch data từ 24 bảng còn lại. Bật RLS trên 24/24 bảng với 96 policies (SELECT/INSERT/UPDATE/DELETE cho authenticated users). Backend dùng service_role bypass RLS → hoạt động bình thường.

- `2026-09-02` — **Hoàn thiện UI Kho Ngữ Liệu & Tính năng Xuất Đề LaTeX**: Đã xây dựng hoàn chỉnh giao diện danh sách Ngữ liệu (`PassagesPage`) và form soạn thảo Markdown (`PassageFormPage`) cho "Kho ngữ liệu (Đọc)" riêng biệt với Kho Lưu trữ Media. Cùng với đó, hoàn thành API xuất đề thi định dạng `.tex` qua `LatexService` tích hợp thẳng vào giao diện Admin (`ExamDetailPage`), hỗ trợ tự động gộp nội dung passage cho các câu hỏi và inject template tiếng Việt (`fontenc T5`).

- `2026-09-02` — **Hoàn thành Giai đoạn 5: Frontend UI (Ma trận đặc tả)**: Đã tích hợp thành công 5 loại biểu đồ đa cấp (Sunburst, Treemap, Sankey, Stacked Bar, Radar) vào `MatrixVisualization` sử dụng `recharts` và `react-plotly.js`. Cập nhật `MatrixFormPage` với Widget Health Score real-time (tự động gọi API check-feasibility-local mỗi khi sửa lưới) và thêm Banner cảnh báo Versioning đỏ gắt nếu cố lưu đè lên ma trận đã dùng. Tích hợp nút tải ảnh vào `MatrixImportModal` để kết nối với Vision API backend. Đã check-off task Giai đoạn 5.

- `2026-09-02` — **Hoàn thành Phần 0 (Refactor Database & API core)**: Chuyển hoàn toàn `Question` sang mô hình đa-skill (bảng `question_skill_tag`), xoá `knowledge_node_id` trong Question và `parent_id` trong KnowledgeNode. Các service đếm câu hỏi (`knowledge_service.py`), sinh ma trận (`exam_matrix_generator.py`), sinh đề (`generator.py`), search vector (`embedding_service.py`, `vector.py`), nhập import (`obsidian_parser.py`, `passages.py`) đã được map lại để sử dụng query JOIN qua `question_skill_tag`. Migration `c1234567890a` đã upgrade `head` thành công trên DB. Báo cáo lại để xin phép tiến hành Phần 1-7 tiếp theo.

- `2026-09-01` — **Fix lỗi "Not a participant of this exam" khi thí sinh bắt đầu thi**: nguyên nhân — `get_or_assign_exam_form` (services/exam_session.py) trả 403 nếu học sinh chưa có dòng `ExamParticipant`, trong khi UI thí sinh cho phép bấm "Bắt đầu thi" ở mọi kỳ thi PUBLISHED mà Admin chưa gán danh sách. Fix bằng **self-enrollment**: nếu participant chưa tồn tại và exam `status = PUBLISHED` → tự tạo participant (flush) rồi gán mã đề như luồng cũ; exam không tồn tại → 404; chưa PUBLISHED (DRAFT/COMPLETED) → giữ 403. Đồng thời `get_exam_session_info` khi vào thẳng `/exam/:id/session` mà chưa ghi danh cũng tự gọi `get_or_assign_exam_form` rồi load lại session. Cập nhật `test_unit_db_mocking.py` (test cũ 403 → 404 khi exam không tồn tại) + thêm 2 test (self-enroll PUBLISHED thành công, chặn DRAFT). 21/21 test mock-based pass, compileall OK.

- `2026-09-01` — **Trang xem Kết quả cho Thí sinh (`/student/exam/{exam_id}/result`)**:
  - Backend: service mới `app/services/exam_result.py` + thay thân endpoint `GET /api/v1/exams/{exam_id}/result` (trước đó KHÔNG chặn thí sinh đang thi vì ExamSubmission tồn tại ngay từ IN_PROGRESS qua autosave). Rule: chỉ SUBMITTED/SUSPENDED được xem (IN_PROGRESS/NOT_STARTED → 403); điểm thô CTT theo 4 phần luôn có ngay sau nộp (tự gọi `grade_submission_ctt` idempotent nếu chưa có); điểm thực IRT CHỈ hiện khi IrtTask SUCCESS + N≥200 (đồng bộ `IRT_THRESHOLD` ở `complete_exam`) + ExamResult.score_method=IRT, ngược lại trả state/message ("computing", "not_enough_data", ...); xem lại đáp án theo đúng permission `user.can_view_answers` (module "Quyền xem đáp án" ở Admin), không trả đúng đáp án ra API khi không có quyền.
  - Frontend: trang mới `StudentExamResultPage.tsx` (theme Thí sinh sáng, framer-motion, không biểu đồ phức tạp), api `studentExamResult.ts`, route `/student/exam/:examId/result`; `StudentExamShell` sau nộp bài (thủ công + auto-submit hết giờ) điều hướng sang trang kết quả, màn "Bạn đã nộp bài" thêm nút "Xem kết quả".
  - Test: `backend/tests/test_exam_result_service.py` — 11 test (block IN_PROGRESS/NOT_STARTED, SUSPENDED vẫn xem, gate IRT theo N≥200, không lộ IRT khi chưa đủ điều kiện). 19/19 test mock-based pass; `python -m compileall` OK; `npm run build` không có lỗi mới ở file mới (các lỗi TS có sẵn khác ngoài phạm vi).
  - Ghi chú: hệ thống chưa có module "Phân loại năng lực" được tính sẵn → trang này không bịa số liệu, sẽ hiển thị khi có.

- `2026-09-01` — **Xử lý khẩn cấp secret và Git tracking**: xóa `backend/scripts/create_supabase_users.py` khỏi working tree sau khi xác nhận file đã xuất hiện trong 4 commit lịch sử; xác nhận `backend/app` đang track 56 file; untrack `backend/venv2` thành công, còn 0 file trong Git index. Chưa rotate/revoke Supabase key, rewrite lịch sử Git, commit hoặc push vì cần chủ repo thực hiện Dashboard rotation và xác nhận remote.
- `2026-09-01` — **Ma trận Đặc tả — Full System Upgrade**:
  - Backend: Thêm `POST /matrix/{id}/check-feasibility` (dry-run), `GET /matrix/{id}/usage`, `POST /matrix/{id}/create-version`. `update_matrix` chặn ghi đè khi matrix đã dùng (409).
  - Frontend: Tạo `SmartMatrixWizard.tsx` (3 bước: scope DAG → propose → confirm), `MatrixDetailPage` nâng cấp với "Kiểm tra khả thi" button, `MatrixPage` thêm Smart Builder + detail view, `MatrixDistributionCharts` dùng knowledge_node.name, `MatrixImportModal` fix imports, versioning banner khi edit used matrix.
  - Fix: Xóa trailing backtick 3 file, register orphaned route, TypeScript errors.
- `2026-09-01` — **Audit checklist và Git ignore**: xác nhận `backend/app` đang được Git track (56 file), nhưng `backend/venv2` cũng đã từng bị track (8.652 file), nên thêm `backend/venv2/` vào `.gitignore`; cần untrack bằng `git rm -r --cached backend/venv2` trước khi commit. Chưa đánh dấu hoàn thành prompt GitHub vì chưa có thao tác push/backup xác nhận.
- `2026-09-01` — **Audit luồng nạp Supabase Auth**: xác nhận repo hiện không có endpoint bulk import; script `create_supabase_users.py` chỉ gọi `auth.admin.create_user()` và không ghi bảng `user`. Thêm `scripts/provision_users.py` tạo Auth + `User.supabase_id`/role với rollback xóa Auth khi insert app thất bại; thêm `scripts/audit_orphan_auth_users.py` chỉ đọc để liệt kê Auth student mồ côi. Đã kiểm tra cú pháp Python; `npm run lint` vẫn đang fail 206 lỗi frontend tồn tại từ trước.
- `2026-08-31` — **Tách UI Kho ngữ liệu**: tách rõ `Ngữ liệu đọc` thành bảng dữ liệu riêng với mã, tiêu đề/nội dung, số câu hỏi và thao tác sửa; tách `Ảnh & PDF` thành luồng upload/quản lý file riêng; bỏ upload/chèn file khỏi form ghi bài đọc để tránh gộp sai chức năng.
- `2026-08-31` — **Cải thiện Kho ngữ liệu**: khôi phục luồng quản lý ảnh/PDF trên `ResourcesPage` bằng tab riêng, upload/list/delete/open file qua Resources API; bổ sung đính kèm ảnh/PDF ngay trong form ghi ngữ liệu đọc và chèn liên kết/Markdown vào nội dung passage.
- `2026-08-31` — **Audit backlog tính năng**: đối chiếu scope, tracker và source; xác nhận UI thi đã tồn tại nhưng OMR vẫn mô phỏng, IRT chưa áp ngưỡng N≥200–300, backup chưa hỗ trợ Postgres, import Obsidian còn stub, thiếu offline IndexedDB/CI/load test và một số luồng quản trị/chấm điểm nâng cao.
- `2026-08-30` — **Sửa logic MatrixImportService**: sửa Largest Remainder để luôn bảo toàn tổng số câu và chuẩn hóa ratio; parser hỗ trợ CSV/TSV quoting, header và fallback dialect; phân bổ level/type chính xác; validate count/part/strategy; strategy `add` gộp rule trùng thay vì tạo duplicate; matching quan hệ node dùng primary parent.
- `2026-08-30` — **Tổ chức lại Sidebar Admin**: audit xác nhận 12 mục và giữ nguyên route; nhóm thành 4 section có thể thu gọn, lưu trạng thái bằng `localStorage`, tự mở nhóm chứa route active; thêm command palette tìm nhanh bằng `Ctrl/Cmd+K`, Enter để mở trang.
- `2026-08-31` — **Tối ưu xóa, ConfirmDialog, Error Logging**:
  - Backend: bulk delete knowledge node (DAG relations + manual links + node trong 1 transaction), thêm global exception handler ghi lỗi vào `logs/app_error.log` (RotatingFileHandler 5MB, auto-cleanup mỗi 10 phút).
  - Frontend: tạo `errorLog.ts` (localStorage, auto-xóa entries > 10 phút, max 200 entries), thay `window.confirm` bằng `ConfirmDialog` ở MatrixPage, MatrixDetailPage, ObsidianPage.
- `2026-08-31` — **Chuyển KnowledgeNode sang DAG đa-cha**: Viết script audit (`scripts/audit_knowledge_leaves.py`) xác nhận vi phạm node41 "Kiến thức chung" (TOPIC, 60 câu hỏi, có con). Sửa `exam_matrix_generator.py` dùng `knowledge_node_parent` DAG table thay vì `parent_id` cũ trong 2 query (`load_pool_from_db`, `parse_matrix_rules`). Sửa `obsidian_parser.py` dùng `KnowledgeService.add_relation()` thay vì ghi `parent_id` trực tiếp. Sửa `knowledge.py` API: `create_knowledge_node` và `update_knowledge_node` exclude `parent_id` khỏi model dump, chỉ ghi vào DAG table. Thêm hiển thị "Node này còn thuộc:" (secondary parents) vào `KnowledgeNodeSelector.tsx`. Column `parent_id` cũ được giữ lại để rollback.
- `2026-08-30` — **Sửa Git tracking backend**: cập nhật `.gitignore` để loại trừ `backend/venv3/`, cache Python/Pytest/TypeScript; đưa source `backend/app`, `backend/alembic`, `backend/tests` và `backend/requirements.txt` vào Git; loại `backend/venv3` và `frontend/tsconfig.tsbuildinfo` khỏi tracking mà vẫn giữ virtual environment trên đĩa.
- `2026-08-30` — **Hoàn thiện Cấu hình Hệ thống, Nhật ký Audit & Khắc phục Race Condition**:
  - Khắc phục lỗi tương tranh (Race Condition) bằng Row-level lock (`with_for_update()`) cho bảng `ExamParticipant` ở Backend. Khi Admin đình chỉ thi (`/suspend`), lệnh nộp bài (`/submit`) hoặc lưu nháp (`/autosave`) từ học sinh cùng thời điểm sẽ bị từ chối với mã 403.
  - Xây dựng thành công `AuditLogsPage` và API `GET /api/v1/admin/audit-logs` để ghi nhận chi tiết lịch sử thao tác của Admin (tạo user, khóa tài khoản, đổi cài đặt, v.v.).
  - Xây dựng `SystemSettingsPage`, bảng DB `system_setting`, và API cho phép tùy chỉnh động các tham số toàn cục. Cập nhật `advanced_analytics.py` và `main.py` để đọc linh hoạt `FRAUD_THRESHOLD` (ngưỡng cảnh báo gian lận) từ Database thay vì gán tĩnh. Đã check toàn bộ Task trong Phase 9 là hoàn thành.
- `2026-08-30` — **Tái thiết kế Giao diện Thí sinh (Student UI)**: Đã tách biệt hoàn toàn thiết kế giao diện phòng thi (`StudentExamShell`, `StudentHomePage`) khỏi UI của Admin. Trang bị bảng màu mới (studentPrimary, studentNeutral), bắt buộc ép Light Mode, tạo riêng Component (Card, Button, Dialog) với thiết kế đơn giản, phẳng, rõ ràng để giảm tải nhận thức (cognitive load).
- `2026-08-30` — **Cải thiện trang Báo Cáo Phân Tích Dữ Liệu (DS111)**: Nâng cấp `AdvancedAnalyticsPage.tsx` bằng cách thêm 4 thẻ KPI nổi bật, xây dựng **Bảng Thống kê Mô tả Tổng quan** (Mean, Median, SD, Min, Max), và **Bảng Cảnh báo Câu hỏi (Flagged Items)** giúp phát hiện nhanh câu hỏi có độ phân biệt thấp ($a < 0.5$) hoặc độ khó ngoài ngưỡng ($|b| > 3$). Viết thêm 2 API Backend tương ứng (`/descriptive-stats`, `/flagged-items`).
- `2026-08-30` — **Hoàn thiện Cải tiến Tạo & Phân loại Câu hỏi (Phần B)**: Xây dựng thành công `KnowledgeNodeSelector` trên frontend; tích hợp tính năng lọc động loại câu hỏi (Trắc nghiệm, Đúng/Sai, Điền khuyết) vào `QuestionFormPage` và `QuestionBlock`; cải thiện form check trùng lặp (hiển thị popup Cảnh báo trùng lặp nội dung trước khi lưu); trang bị đầy đủ bộ filter mới (Level, Type, Passage, Knowledge Node) và thêm tab Hàng chờ duyệt (`PENDING`) cho `QuestionsPage`.
- `2026-08-31` — **Hoàn thiện ObsidianPage Cải tiến**: Fix click issues (onNodeClick vs onNodeDrag conflict), thêm field Note riêng với Description trong form tạo node, thêm inline edit cho Description trong detail panel, sửa API calls gửi cả description + note khi tạo/update, fix TypeScript errors. Build check passed.
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
- `2026-09-01` — Chạy thử hệ thống: kiểm tra backend + frontend hoạt động ✅. Fix bug CORS + Supabase auto-user-creation (handle duplicate username). Kiểm tra toàn bộ code StudentExamShell + sub-components: QuestionNavGrid (5-column grid) ✅, QuestionRenderer (SINGLE/MULTIPLE_CHOICE) ✅, PassageSplitPane (split view) ✅. Fix auth endpoint auto-create user logic để generate unique username. Giao diện phòng thi 80% hoàn thiện, còn thiếu: TRUE_FALSE/FILL_IN_BLANK/COMPOSITE question types, participant assignment test, offline IndexedDB support, UI polish (mobile responsive, dark mode).
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
