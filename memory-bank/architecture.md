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

- **Dev:** local (Docker Compose: postgres, redis, api, worker, frontend dev servers).
- **Staging/Prod (giai đoạn đầu):** free tier Render/Railway (API+worker) + Supabase (Postgres) — nâng cấp lên VPS khi cần scale.

## Bảo mật tổng quan

- JWT access + refresh token, blacklist trong Redis khi logout.
- RBAC theo bảng `VaiTro`, kiểm tra ở dependency FastAPI, không kiểm tra ở frontend only.
- Rate limiting theo IP + theo user tại các endpoint nộp bài (dùng `slowapi` hoặc middleware tương tự).
- Tất cả traffic qua HTTPS; cookie httpOnly cho refresh token.

## Phụ lục — Đối chiếu tên bảng ERD gốc (tiếng Việt) ↔ tên bảng thật (tiếng Anh)

> Agent cập nhật bảng này khi đặt tên chính thức cho model SQLAlchemy — tránh mỗi người dùng một tên khác nhau cho cùng 1 khái niệm.

| Tên ERD gốc | Tên bảng thật (đề xuất) | Ghi chú |
|---|---|---|
| PhanThi | `Section` | Tiếng Việt/Tiếng Anh/Toán/TDKH |
| KienThuc | `KnowledgeNode` | Cây phân cấp qua `parent_id` |
| NguLieu | `Resource` | Ảnh/PDF/link |
| CauHoi | `Question` | |
| DapAn | `Answer` | |
| User | `User` | |
| VaiTro | `Role` | Mới thêm theo yêu cầu phân quyền |
| KyThi | `Exam` | |
| MaTran | `Matrix` | |
| DeThi | `ExamForm` | 1 đề gốc, chưa xáo |
| CauHoiDeThi | `ExamFormQuestion` | Mapping vị trí→câu gốc theo mã đề |
| DapAnDeThi | `ExamFormAnswer` | Mapping vị trí đáp án theo mã đề |
| ThiSinh | `Candidate` | |
| BaiLam | `Submission` | |
| DuLieuBaiLam | `SubmissionData` | |
| ItemAnalysis | `ItemAnalysis` | Giữ nguyên |
