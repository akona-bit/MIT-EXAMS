# Code Standards

## Nguyên tắc ngôn ngữ

- **Code identifiers (biến, hàm, class, tên bảng DB, route API): tiếng Anh**, ví dụ `Question`, `ExamSession`, `/api/v1/exams`.
- **Domain/UI labels, comment nghiệp vụ, tên hiển thị: tiếng Việt**, ví dụ label UI "Mã đề", "Số báo danh".
- Tên bảng/cột trong ERD gốc dùng tiếng Việt không dấu (PhanThi, CauHoi...) — khi hiện thực hoá thành bảng SQL thật, **chuyển sang tiếng Anh** (`Question`, `Section`...). Bảng đối chiếu đầy đủ nằm ở `architecture.md` (phụ lục cuối file) — agent cập nhật bảng đó khi đặt tên chính thức, không tự ý đặt tên khác đi mỗi lần.

## Backend (Python / FastAPI)

- Python 3.11+, tuân thủ PEP8, format bằng `ruff format`, lint bằng `ruff check`.
- Toàn bộ function/method có type hints đầy đủ.
- Pydantic v2 cho schema request/response — không trả raw SQLAlchemy model ra API.
- Router tổ chức theo domain (`app/api/v1/exams.py`, không theo REST verb).
- Business logic KHÔNG nằm trong router — router gọi `service/` layer, service gọi `repository/` layer (SQLAlchemy).
- Dùng SQLAlchemy 2.0 style (`Mapped[]`, `mapped_column`), Alembic cho migration — **không** dùng `Base.metadata.create_all()` ở production.
- Mọi endpoint ghi dữ liệu phải có validate quyền qua dependency (`Depends(require_role(...))`).
- Task nặng (OMR, IRT) luôn là Celery task riêng biệt, endpoint trả `202 Accepted` + `task_id`.
- Response envelope chuẩn: `{"data": ..., "meta": {...}}` khi thành công, `{"error": {"code": ..., "message": ...}}` khi lỗi.
- Test bằng `pytest` + `pytest-asyncio`; mọi service/module mới bắt buộc có ít nhất test cho happy path + 1 edge case.

## Frontend (React)

- TypeScript bắt buộc, không dùng `any` trừ khi có comment giải thích lý do.
- Function components + hooks, không dùng class component.
- Tổ chức theo feature (`src/features/exam-bank/`, `src/features/exam-session/`...), không tổ chức theo loại file (không có `components/`, `hooks/` phẳng ở root).
- Server state: TanStack Query (React Query) — không tự quản lý loading/error state thủ công cho data fetching.
- Client state cục bộ: React state; state chia sẻ phức tạp (vd trạng thái làm bài): Zustand.
- Style: TailwindCSS utility-first, dùng design token trong `ui-tokens.md`, **không hard-code màu/spacing tuỳ tiện**.
- Form: `react-hook-form` + `zod` để validate.
- Component mới trước khi tạo: kiểm tra `ui-registry.md` xem đã có component tương tự chưa.

## Versioning câu hỏi (áp dụng khi sửa CauHoi/Question)

- Câu hỏi có cột `status` (Nháp/ChoDuyet/DaDuyet) và `version`.
- Nếu câu hỏi **chưa từng dùng trong đề thi đã tổ chức**: cho phép sửa trực tiếp (update in-place).
- Nếu câu hỏi **đã dùng trong ít nhất 1 đề thi đã tổ chức**: sửa nội dung phải tạo **bản ghi mới** (`version + 1`, `previous_version_id` trỏ về bản cũ), giữ nguyên bản cũ để các `ExamFormQuestion`/`ItemAnalysis` lịch sử vẫn tham chiếu đúng dữ liệu đã dùng khi thi.

## Git

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- Branch: `feature/<ten-ngan>`, `fix/<ten-ngan>`.
- Không commit trực tiếp lên `main`; PR bắt buộc pass lint + test.

## Bảo mật code

- Không log dữ liệu nhạy cảm (mật khẩu, token) dù ở debug level.
- Input từ người dùng luôn qua Pydantic validate trước khi chạm DB.
- Câu hỏi/đáp án trong DB không bao giờ trả kèm response API cho thí sinh trước khi nộp bài (tránh lộ đáp án qua Network tab của trình duyệt).
