# AGENTS.md — Hướng dẫn cho AI Agent làm việc trên dự án này

> File này được đọc đầu tiên bởi bất kỳ agent nào (Gemini 3.1 Pro trên Antigravity, hoặc agent khác) khi bắt đầu phiên làm việc trong repo này. Nó đóng vai trò "kim chỉ nam" — mọi quyết định kỹ thuật phải nhất quán với nội dung ở đây và trong thư mục `memory-bank/`.

## Dự án là gì (tóm tắt 30 giây)

Xây dựng MIT EXAMS, một nền tảng quản lý ngân hàng câu hỏi và tổ chức thi trắc nghiệm trực tuyến quy mô lớn, tương tự Azota.vn, chuyên biệt cho các kỳ thi dạng ĐGNL (120 câu, 4 phần, thang điểm 0-300/phần). Hệ thống bao gồm: sinh đề tự động từ ma trận đặc tả, tổ chức thi online/offline (OMR), chấm điểm bằng IRT 2PL/CTT, và thống kê/phân tích chất lượng đề thi.

Chi tiết đầy đủ: đọc `memory-bank/project-overview.md` trước khi làm bất kỳ task nào.

## Thứ tự đọc context bắt buộc

1. `memory-bank/project-overview.md` — phạm vi & mục tiêu
2. `memory-bank/architecture.md` — kiến trúc hệ thống
3. `memory-bank/build-plan.md` + `memory-bank/progress-tracker.md` — đang ở giai đoạn nào, làm gì tiếp theo
4. `memory-bank/code-standards.md` — quy ước code trước khi viết bất kỳ dòng nào
5. Khi làm UI: thêm `memory-bank/ui-tokens.md`, `memory-bank/ui-rules.md`, `memory-bank/ui-registry.md`
6. Khi cần thư viện cụ thể: `memory-bank/library-docs.md`

## Quy tắc bất di bất dịch (non-negotiable)

- **Không bao giờ ghi đè câu hỏi đã dùng trong đề thi đã tổ chức** — luôn tạo version mới (xem `code-standards.md` mục Versioning).
- **Không chạy MMLE/IRT đồng bộ trong request API** — luôn qua Celery task, trả về `task_id` để client poll.
- **Vị trí câu hỏi trong đề (mã đề) ≠ ID câu hỏi gốc trong ngân hàng.** Luôn map qua bảng `CauHoiDeThi`/`DapAnDeThi`, không bao giờ hard-code theo thứ tự 1-120 khi thao tác với ngân hàng câu hỏi.
- **Ngưỡng N ≥ 200-300 lượt làm** mới được dùng kết quả MMLE-IRT làm chính thức; dưới ngưỡng đó dùng CTT/thưởng-phạt.
- Toàn bộ stack **phải free/mã nguồn mở** — không thêm dependency có phí mà không hỏi trước.
- Domain terms giữ tiếng Việt trong UI/comment nghiệp vụ (Mã đề, Số báo danh, Ma trận đặc tả...), nhưng **code identifiers (biến, hàm, bảng DB, API route) dùng tiếng Anh** — xem quy ước đầy đủ trong `code-standards.md`.

## Cập nhật progress-tracker.md

Sau khi hoàn thành bất kỳ task nào, **luôn cập nhật** `memory-bank/progress-tracker.md` (tick checkbox, ghi chú ngày + tóm tắt) trước khi kết thúc phiên làm việc. Đây là cách duy nhất để agent phiên sau biết được trạng thái thật của dự án — đừng bỏ qua bước này.

## Skills sẵn có

Xem `.agents/skills/` — 4 skill chuyên biệt cho các phần nghiệp vụ phức tạp nhất của dự án:
- `sinh-de-tu-dong` — sinh đề theo ma trận đặc tả + xáo mã đề
- `cham-diem-ctt-irt` — chấm điểm CTT/IRT 2PL, tích hợp `irt.py`/`ctt.py` có sẵn
- `omr-reader` — đọc phiếu trả lời trắc nghiệm quét/scan bằng OpenCV
- `bao-mat-thi-online` — chống gian lận cho phiên thi trực tuyến

Agent nên tự động kích hoạt các skill này khi làm task liên quan (semantic triggering) — không cần người dùng gọi tên.

## Mã nguồn tham khảo đã có sẵn (không tự phát minh lại)

Các file Python sau đã được kiểm chứng qua đồ án phân tích dữ liệu thật (1221 lượt làm bài, 2 đề thi chuẩn hoá) — khi tích hợp, đọc trực tiếp và bọc thành service, **không viết lại thuật toán từ đầu**:
- `irt.py` — IRT 2PL tự cài đặt (MMLE, Newton-Raphson, Gauss-Hermite K=81, EAP theta, chi-square fit)
- `ctt.py` — CTT (độ khó, độ phân biệt D-Index, độ nhiễu Pt.Bis)
- `item_plot.py` — logic `chamDiem()` (mapping vị trí→câu gốc theo mã đề) và `tach_phan()` (tách 4 phần thi)
