# Architecture

## Nguyên tắc thiết kế

1. **Tách API khỏi xử lý nặng.** API (FastAPI) chỉ nhận request, validate, ghi vào DB/queue, trả response nhanh. Mọi việc tốn CPU (OMR, MMLE-IRT, sinh đề hàng loạt) chạy trong Celery worker.
2. **Stateless API.** Không lưu session state trong bộ nhớ process; dùng JWT + Redis cho session/token blacklist.
3. **Idempotent grading.** Chấm lại một bài thi nhiều lần phải cho cùng kết quả nếu input không đổi — không có side-effect ẩn.
4. **Không ghi đè, luôn version.** Áp dụng cho câu hỏi, tham số IRT, và bản chấm điểm.
5. **Free/open-source only** cho toàn bộ stack ở giai đoạn này.

## Sơ đồ thành phần

```
+------------------+      +------------------+
|  Admin Frontend  |      | Student Frontend |
|  React+Vite+TS   |      |  React/Next.js   |
|  (Tailwind)      |      |                  |
+--------+---------+      +--------+---------+
         | HTTPS/REST              | HTTPS/REST + WebSocket (timer/giam sat)
         +-----------+--------------+
                      v
            +--------------------+
            |   FastAPI (API)    |---- JWT Auth, RBAC (VaiTro)
            |   /api/v1/...      |
            +---------+----------+
                       |
         +-------------+--------------+
         v              v              v
   +-----------+  +-----------+  +--------------+
   | PostgreSQL|  |   Redis   |  | File Storage |
   |  (DB chinh)| |(broker/   |  | (anh OMR,    |
   |           |  | cache)    |  |  PDF, ngu lieu)|
   +-----------+  +-----+-----+  +--------------+
                        |
                        v
              +--------------------+
              |  Celery Workers    |
              | +----------------+ |
              | | Worker: OMR    | |-- OpenCV/NumPy
              | | Worker: IRT    | |-- irt.py/ctt.py (MMLE, Gauss-Hermite)
              | | Worker: Gen    | |-- Sinh de theo ma tran
              | +----------------+ |
              +--------------------+
```

## Các service/module backend (theo domain, không theo layer)

- `auth/` — đăng nhập, JWT, RBAC theo `VaiTro`
- `question_bank/` — CRUD CauHoi, KienThuc, DapAn, workflow duyệt, versioning, duplicate detection
- `resource_bank/` — NguLieu (ảnh/PDF/link)
- `matrix/` — MaTran, logic sinh đề tự động + ràng buộc
- `exam/` — KyThi, DeThi, MaDe, CauHoiDeThi, DapAnDeThi (xáo câu/đáp án)
- `exam_session/` — phiên thi online (thí sinh làm bài, autosave, giám sát thoát tab, timer server-side)
- `grading/` — mapping vị trí→câu gốc, CTT, gọi Celery task IRT
- `irt_engine/` — wrapper quanh `irt.py`/`ctt.py` hiện có, chạy trong Celery
- `omr/` — nhận ảnh, gọi OpenCV pipeline, hàng đợi review thủ công
- `stats/` — dashboard, so sánh chất lượng đề qua các đợt
- `security/` — audit log, giám sát thoát tab, chặn copy-paste (phối hợp frontend)
- `obsidian_memory/` — đồng bộ vault Obsidian, import cây `KnowledgeNode`, câu hỏi từ frontmatter, và cung cấp tree/graph cho frontend. Quy ước chi tiết ở `memory-bank/obsidian-ai-memory.md`.

## Luồng dữ liệu chính

**1. Sinh đề:**
`MaTran` (giáo viên nhập) → validate ràng buộc → chọn câu hỏi từ `CauHoi` (trạng thái Đã duyệt) → tạo `DeThi` gốc → nhân bản N mã đề với vị trí câu/đáp án xáo random có kiểm soát → lưu `CauHoiDeThi`/`DapAnDeThi`.

**2. Thi online:**
Thí sinh vào phiên → nhận đề theo mã đề được gán → autosave câu trả lời (IndexedDB + sync server định kỳ) → nộp bài → ghi `BaiLam`/`DuLieuBaiLam`.

**3. Thi offline (OMR):**
Giáo viên upload ảnh/PDF phiếu quét hàng loạt → Celery worker chạy OpenCV (căn 4 góc, đọc SBD/Mã đề/đáp án) → độ tin cậy thấp → đưa vào hàng review thủ công; độ tin cậy cao → tự ghi `DuLieuBaiLam`.

**4. Chấm điểm:**
`DuLieuBaiLam` (theo vị trí) + `DapAnDeThi` (mapping vị trí→câu gốc) → ma trận điểm 1/0/-1 theo câu gốc → tính CTT ngay (đồng bộ, nhẹ) → nếu đủ N≥200-300, enqueue Celery job chạy MMLE-IRT → cập nhật `ItemAnalysis` + điểm thực 0-300/phần cho từng `BaiLam`.

## Environments

- **Dev:** local (task_always_eager — Celery chạy sync trong FastAPI process, không cần Redis worker).
- **Production:**
  - Frontend: **Vercel** (2 `vercel.json` — root monorepo + `frontend/vercel.json`)
  - Backend API: **Render** web service (`render.yaml` → `Dockerfile`)
  - Celery Worker: **Render** worker service (`render.yaml`)
  - Database: **Supabase** (PostgreSQL managed)
  - File Storage: Supabase Storage

## Celery

- **App definition:** `backend/app/worker.py` — `celery_app = Celery("exams_worker", ...)`
- **Local:** `task_always_eager=True` khi `REDIS_URL=localhost` — chạy sync, không cần worker riêng
- **Production:** `render.yaml` define worker service chạy `celery -A app.worker.celery_app worker`
- **Task modules:** `app.services.grading.scorer` (IRT calibration), `app.services.omr.tasks` (OMR processing), `app.services.email_tasks` (OTP emails)
- **⚠️ Known bug:** `render.yaml` line 27 ghi `app.core.celery_app` — SAI, phải là `app.worker.celery_app`. Chưa sửa.

## Analytics

- **PostHog:** Backend đang capture ~30 events (exams, grading, matrix, knowledge, OMR, questions, resources) qua `app/core/analytics.py`.
- Frontend `posthog.ts` defined nhưng **chưa import ở đâu** — dead code.
- Env vars: `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST` (backend), `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` (frontend).

## Trạng thái `item_plot.py`

- File: `backend/app/services/grading/item_plot.py` — **đã commit** (3 commits), nằm trong repo.
- Chứa `chamDiem()`, `tach_phan()`, `ketQuaCham()` + 6 hàm visualization.
- **Backend KHÔNG import file này.** `scorer.py` đã reimplement `score_question_answer()` (hỗ trợ nhiều loại câu hỏi hơn) và logic `tach_phan` inline (scorer.py:411-419).
- `library-docs.md` nói "bọc trong `irt_engine/service.py`" nhưng chưa làm — và scorer.py đã thay thế hầu hết logic.
- **Rủi ro:** Format CSV `STT_gốc-Đáp_án` trong `chamDiem()` (item_plot.py:67-85) không có tương đương trong `scorer.py`. Nếu cần import CSV cũ, phải port riêng hàm parse đó.

## Bảo mật tổng quan

- JWT access + refresh token, blacklist trong Redis khi logout.
- RBAC theo bảng `VaiTro`, kiểm tra ở dependency FastAPI, không kiểm tra ở frontend only.
- Rate limiting theo IP + theo user tại các endpoint nộp bài (dùng `slowapi` hoặc middleware tương tự).
- Tất cả traffic qua HTTPS; cookie httpOnly cho refresh token.

## Trạng thái QuestionFormPage

- File: `frontend/src/pages/admin/QuestionFormPage.tsx`
- **Không dùng 3 dropdown Topic/Concept/Skill.** Dùng `KnowledgeNodeSelector` — searchable combobox.
- Submit payload: `primary_knowledge_node_id` (int) + `secondary_knowledge_node_ids` (int[]).
- AI auto-suggest: `suggestQuestionTags()` trả `primary_suggestion` + `secondary_suggestions`.
- **Gap:** Không hiển thị cấu trúc DAG (no tree view, no multi-parent visual selector). Context panel chỉ hiện breadcrumb đọc-only.

## 8. Phụ lục — Đối chiếu tên bảng ERD gốc (tiếng Việt) ↔ tên bảng thật (tiếng Anh - Officially Confirmed)

> Agent cập nhật bảng này khi đặt tên chính thức cho model SQLAlchemy — tránh mỗi người dùng một tên khác nhau cho cùng 1 khái niệm. Đã chốt dùng tiếng Anh 100% trong code.

| Tên ERD gốc | Tên bảng thật (đã chốt) | Ghi chú |
|---|---|---|
| PhanThi | `Section` | Tiếng Việt/Tiếng Anh/Toán/TDKH |
| KienThuc | `KnowledgeNode` | DAG đa-cha qua `knowledge_node_parent` (không còn `parent_id` đơn) |
| NguLieu | `Passage` / `Resource` | Ảnh/PDF/đoạn văn |
| CauHoi | `Question` | |
| DapAn | `Answer` | |
| User | `User` | |
| VaiTro | `Role` | Mới thêm theo yêu cầu phân quyền |
| KyThi | `Exam` | |
| MaTran | `Matrix`, `MatrixRule`, `MatrixRuleGroup` | |
| DeThi | `ExamForm` | 1 đề mã hoá |
| CauHoiDeThi | `ExamFormQuestion` | Mapping vị trí→câu gốc theo mã đề |
| DapAnDeThi | `ExamFormAnswer` | Mapping vị trí đáp án theo mã đề |
| ThiSinh | `ExamParticipant` | |
| BaiLam | `ExamSubmission` | |
| DuLieuBaiLam | `ExamSubmissionAnswer` | |
| ItemAnalysis | `ItemAnalysisResult` | Giữ nguyên |
| ChamDiem | `ExamResult` | Điểm bài thi (CTT/IRT) |
| OMR | `OmrSession`, `OmrRecord` | Chấm thi OMR |
| — | `KnowledgeNodeParent` | DAG parent-child (multi-parent, 1 primary). Bảng mới thay `parent_id` đơn |
| — | `QuestionSkillTag` | Multi-skill per question (thay `knowledge_node_id` đơn). Cols: `question_id`, `knowledge_node_id`, `is_primary` |
| — | `KnowledgeNodeLink` | Manual cross-link giữa 2 node (non-hierarchical). Cols: `source_id`, `target_id`, `label` |
