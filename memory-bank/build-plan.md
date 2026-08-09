# Build Plan

> Thứ tự các giai đoạn có tính phụ thuộc — không nhảy cóc trừ khi ghi rõ lý do trong `progress-tracker.md`.

## Giai đoạn 0 — Nền tảng hạ tầng
- Khởi tạo repo: cấu trúc thư mục backend/frontend, Docker Compose (postgres, redis).
- FastAPI skeleton + healthcheck endpoint.
- Alembic init.
- CI cơ bản (lint + test) nếu có điều kiện.

## Giai đoạn 1 — Auth & Phân quyền
- Bảng `User`, `Role` (VaiTro).
- Đăng ký/đăng nhập, JWT access+refresh.
- Middleware/dependency RBAC.

## Giai đoạn 2 — Ngân hàng câu hỏi & Ngữ liệu
- Schema `Question`, `Answer`, `KnowledgeNode` (cây phân cấp), `Resource`.
- CRUD API + Admin UI cơ bản (`QuestionEditor`, `ResourceUploader`).
- Workflow duyệt: Nháp → Chờ duyệt → Đã duyệt.
- Versioning câu hỏi (không ghi đè — xem `code-standards.md`).

## Giai đoạn 3 — Ma trận đặc tả & Sinh đề tự động
- Schema `Matrix`.
- `MatrixBuilder` UI.
- Engine chọn câu hỏi theo ràng buộc (đủ số lượng/mức độ/dạng câu mỗi ô ma trận, không trùng câu) — xem skill `sinh-de-tu-dong`.
- Xáo mã đề (vị trí câu + đáp án) — sinh nhiều mã đề từ 1 đề gốc.

## Giai đoạn 4 — Quản lý Kỳ thi
- Schema `Exam`, `ExamForm`, `ExamFormQuestion`, `ExamFormAnswer`.
- Admin UI tạo/quản lý kỳ thi (theo tham khảo Azota: cài đặt, giao cho, mã đề offline...).

## Giai đoạn 5 — Thi Online (Thí sinh)
- `StudentExamShell`, `QuestionNavGrid`, autosave offline-first.
- Timer đồng bộ server.
- Giám sát thoát tab, chặn copy-paste, watermark SBD — xem skill `bao-mat-thi-online`.
- Giới hạn 1 thiết bị/phiên.

## Giai đoạn 6 — Chấm điểm
- Mapping vị trí→câu gốc (logic `chamDiem()`).
- Tính CTT ngay sau khi nộp bài.
- Tích hợp `irt_engine` (Celery task) — kích hoạt khi đủ N≥200-300. Xem skill `cham-diem-ctt-irt`.
- Cơ chế câu neo (anchor items) cho câu hỏi mới.
- Quy đổi điểm thực 0-300/phần.

## Giai đoạn 7 — OMR (Thi Offline)
- `OmrBatchUploader`.
- Pipeline OpenCV: định vị 4 góc → đọc SBD/Mã đề → đọc 120 ô đáp án. Xem skill `omr-reader`.
- Hàng đợi review thủ công cho ô tô mờ/không chắc chắn (`AnswerSheetPreview`).

## Giai đoạn 8 — Thống kê & Dashboard
- KPI cards, phổ điểm, bảng tần số.
- `ItemAnalysisTable`, cảnh báo misfit/SE cao.
- So sánh chất lượng đề qua nhiều đợt thi.
- Export Excel.

## Giai đoạn 9 — Hoàn thiện
- Backup định kỳ DB.
- Rate limiting endpoint nộp bài.
- Audit log/nhật ký hoạt động.
- Danh sách học sinh bị cấm thi, chuyển kết quả theo SBD mới, chấm lại điểm.
- Kiểm thử tải (nhiều thí sinh nộp bài đồng thời).

## Ghi chú thứ tự
Giai đoạn 5, 6, 7 có thể làm song song một phần sau khi Giai đoạn 4 xong, vì chúng chia sẻ chung dữ liệu `ExamForm`/`ExamFormQuestion` nhưng độc lập về luồng nghiệp vụ.
