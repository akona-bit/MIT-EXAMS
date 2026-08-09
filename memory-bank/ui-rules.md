# UI Rules

## Nguyên tắc chung
- Nhất quán trước, đẹp sau: mọi màn hình admin dùng chung layout (sidebar trái cố định + content area), không tự sáng tạo layout riêng cho từng trang.
- Không thêm màu/spacing ngoài `ui-tokens.md`.
- Trước khi tạo component mới, kiểm tra `ui-registry.md`.

## Trang thi (Student Exam-taking)
- **Fullscreen, tối giản.** Không có nav/menu gây xao nhãng trong lúc làm bài.
- Đồng hồ đếm ngược **luôn hiển thị cố định** (góc trên), đồng bộ với server, không tin tưởng thời gian client.
- Có **bảng điều hướng nhanh** (lưới số câu 1-120, tô màu: đã làm/chưa làm/đang xem).
- Watermark SBD mờ trên nền trang (chống chụp màn hình phát tán).
- Khi phát hiện thoát tab/mất focus: hiện cảnh báo rõ ràng + ghi log, **không** tự động nộp bài trừ khi cấu hình kỳ thi yêu cầu.
- Trạng thái câu trả lời lưu **local trước, sync server sau** (offline-first) — không được để mất câu trả lời khi mất mạng.

## Trang Admin/Giáo viên
- Mật độ thông tin cao được chấp nhận (đây là công cụ làm việc, không phải trang marketing).
- Bảng dữ liệu luôn có: filter, search, phân trang, export Excel (theo mẫu Azota đã tham khảo).
- Thao tác phá huỷ (xoá câu hỏi, huỷ kỳ thi...) luôn có modal xác nhận 2 bước.
- Mọi hành động ghi đè tiềm ẩn rủi ro (sửa câu hỏi đã dùng trong đề cũ) phải cảnh báo rõ: "Câu hỏi này đã dùng trong N kỳ thi — sửa sẽ tạo phiên bản mới, không ảnh hưởng đề đã thi."

## Trang thống kê/Dashboard
- Biểu đồ dùng đúng màu semantic theo phần thi (xem `ui-tokens.md`).
- Luôn hiện số liệu tóm tắt (KPI cards) phía trên biểu đồ chi tiết — theo đúng pattern đã thấy ở Azota (số đăng ký / lượt làm / điểm TB...).
- Cảnh báo câu hỏi misfit/SE cao hiển thị nổi bật (màu `warning`/`danger`), không chôn trong bảng dài.

## Accessibility & Responsive
- Tất cả input có label rõ ràng (không chỉ placeholder).
- Contrast tối thiểu AA (4.5:1) cho text thường.
- Trang admin và trang thí sinh đều tối ưu từ `md` trở lên (xem ghi chú trong `ui-tokens.md`).
