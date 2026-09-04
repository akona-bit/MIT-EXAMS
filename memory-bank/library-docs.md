# Library & Dependency Notes

## Backend (Python)

| Thư viện | Vai trò | Ghi chú |
|---|---|---|
| `fastapi` | API framework | Dùng dependency injection cho auth/RBAC |
| `uvicorn` | ASGI server | `--workers` theo số CPU core khi deploy |
| `sqlalchemy` (2.0) | ORM | Dùng `Mapped[]` style, không dùng Query API cũ |
| `alembic` | Migration | Bắt buộc cho mọi thay đổi schema, không sửa DB tay |
| `pydantic` (v2) | Schema validate | Tách `schemas/` riêng khỏi SQLAlchemy models |
| `celery` | Task queue | Broker = Redis; queue riêng cho `omr`, `irt`, `default` |
| `redis` | Broker + cache | Cũng dùng cho JWT blacklist, rate limit counter |
| `opencv-python` | Xử lý ảnh OMR | Đọc góc định vị, nhận diện ô tô đậm |
| `numpy` | Tính toán ma trận | Dùng chung với `irt.py`/`ctt.py` hiện có |
| `pymupdf` (fitz) | Đọc/tạo PDF đề thi | Ưu tiên hơn `pdfplumber` khi cần ghi PDF |
| `pdfplumber` | Trích xuất text/table từ PDF | Dùng khi import đề thi cũ dạng PDF |
| `python-jose` | JWT | Access + refresh token |
| `passlib[bcrypt]` | Hash mật khẩu | |
| `pytest`, `pytest-asyncio` | Test | |
| `slowapi` | Rate limiting | Áp dụng ở endpoint nộp bài |

**Mã nguồn sẵn có đã tích hợp:** `irt.py` (MMLE 2PL, Gauss-Hermite K=81, EAP theta, chi-square fit) nằm trong `grading/irt_engine.py`. `ctt.py` (độ khó/phân biệt/nhiễu) nằm trong `grading/ctt_engine.py`. Logic `chamDiem()`/`tach_phan()` trong `item_plot.py` **đã bị scorer.py thay thế** (scorer.py reimplement toàn diện hơn, hỗ trợ nhiều loại câu hỏi). Nếu cần import CSV format `STT_gốc-Đáp_án`, phải port riêng hàm parse từ item_plot.py. **Không viết lại thuật toán từ đầu.** Xem skill `cham-diem-ctt-irt` để biết chi tiết quy trình.

## Frontend (React)

| Thư viện | Vai trò | Ghi chú |
|---|---|---|
| `react` + `vite` | Framework/build | TypeScript template |
| `tailwindcss` | Styling | Config theo `ui-tokens.md` |
| `@tanstack/react-query` | Server state | Cache + refetch cho toàn bộ data từ API |
| `react-router-dom` | Routing | |
| `react-hook-form` + `zod` | Form + validate | |
| `recharts` | Biểu đồ thống kê | Phổ điểm, item analysis |
| `axios` | HTTP client | Interceptor gắn JWT + refresh tự động |
| `zustand` | Client state phức tạp | Chỉ dùng khi thực sự cần (vd trạng thái làm bài) |

## Version pinning
Ghi version cụ thể vào `requirements.txt`/`package.json` khi cài đặt thật — không dùng "latest" ở production để tránh breaking change bất ngờ.
