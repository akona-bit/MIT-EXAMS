# Project Overview

## Tên dự án
MIT EXAMS

## Vấn đề cần giải quyết
Các trung tâm luyện thi / trường học tổ chức kỳ thi thử theo định dạng ĐGNL (Đánh giá năng lực) quy mô lớn hiện thiếu công cụ chuyên biệt để: quản lý ngân hàng câu hỏi có kiểm soát chất lượng, tự động sinh nhiều mã đề cân bằng độ khó, tổ chức thi song song online/offline, và chấm điểm theo mô hình khoa học (IRT) thay vì chỉ đếm số câu đúng.

## Người dùng & vai trò

| Vai trò | Mô tả | Quyền chính |
|---|---|---|
| Admin hệ thống | Quản trị toàn bộ | Toàn quyền, quản lý user, cấu hình hệ thống |
| Giáo viên (người tạo đề) | Tạo kỳ thi, đề thi, ma trận | Tạo/sửa đề thi, xem thống kê, chấm lại điểm |
| Người duyệt câu hỏi | Kiểm duyệt chất lượng ngân hàng câu hỏi | Duyệt/từ chối câu hỏi ở trạng thái "Chờ duyệt" |
| Thí sinh | Người làm bài | Làm bài thi, xem kết quả của chính mình |

## Định dạng bài thi chuẩn (không đổi trong toàn hệ thống)

- 120 câu trắc nghiệm, 150 phút.
- 4 phần, mỗi phần 30 câu:
  - Phần 1.1: Tiếng Việt (câu 1-30)
  - Phần 1.2: Tiếng Anh (câu 31-60)
  - Phần 2: Toán học (câu 61-90)
  - Phần 3: Tư duy khoa học / Logic (câu 91-120)
- Mỗi kỳ thi có nhiều **mã đề** (vd 161, 188, 202...) dùng chung ngân hàng câu hỏi gốc nhưng xáo vị trí câu + vị trí đáp án khác nhau.
- Kết quả trả về: 4 đầu điểm theo phần (thang 0-300/phần) + tổng điểm (0-1200) + xếp hạng.

## Phạm vi chức năng (14 module lõi)

1. Quản lý ngân hàng câu hỏi
2. Sinh đề tự động qua ma trận đặc tả (Topic → Concept → Skill)
3. Xáo mã đề (vị trí câu + đáp án)
4. Rút trích đáp án
5. Xử lý ràng buộc khi sinh đề (không trùng câu, đủ số lượng theo từng ô ma trận, cân bằng độ khó)
6. Tạo kỳ thi / đề thi / mã đề
7. Chấm điểm bằng IRT 2PL (tự cài đặt, không dùng thư viện có sẵn)
8. Chấm điểm kép: IRT khi đủ dữ liệu, CTT/thưởng-phạt khi chưa đủ (N < 200-300)
9. Tổ chức thi online (kỳ thi thử + kỳ thi khảo sát)
10. Dashboard thống kê
11. Giao diện thí sinh làm bài / nhập đáp án
12. Chấm thi OMR (phiếu trả lời quét/scan)
13. Ngân hàng câu hỏi (chi tiết: CRUD, phân loại theo Kiến thức)
14. Ngân hàng ngữ liệu (ảnh, PDF, link tham chiếu)

## Yêu cầu mở rộng đã duyệt

- **Bảo mật/chống gian lận:** giám sát thoát tab, chặn copy-paste, giới hạn 1 thiết bị/phiên, watermark SBD lên đề hiển thị.
- **Vận hành ngân hàng câu hỏi:** workflow Nháp → Chờ duyệt → Đã duyệt; versioning (không ghi đè câu đã dùng); phát hiện trùng lặp bằng text embedding.
- **Vòng đời IRT:** cơ chế câu neo (anchor items); lưu lịch sử tham số IRT theo thời gian; ngưỡng N≥200-300 để chuyển từ CTT sang IRT.
- **Trải nghiệm thí sinh:** lưu bài offline-first (IndexedDB), countdown đồng bộ server, xem lại bài làm sau khi có kết quả.
- **Vận hành hạ tầng:** upload OMR hàng loạt + review thủ công ô tô mờ; backup định kỳ; rate limiting lúc nộp bài đông.
- **Thống kê nâng cao:** so sánh chất lượng câu hỏi/đề qua nhiều đợt thi; cảnh báo câu hỏi misfit/SE cao.
- **Phân quyền:** bảng `VaiTro` riêng, không hard-code role trong bảng User.

## Ngoài phạm vi (giai đoạn 1)

- Ứng dụng mobile native (chỉ web responsive).
- Thanh toán/e-commerce.
- Đa ngôn ngữ giao diện (chỉ tiếng Việt trước).
- Chấm tự luận/bài viết (chỉ trắc nghiệm).

## Tiêu chí thành công

- Sinh được 1 đề thi hoàn chỉnh (đủ ràng buộc ma trận) trong < 5 giây.
- Chấm xong 1000 bài thi (mapping + CTT) trong < 30 giây; IRT MMLE chạy nền không chặn UI.
- OMR đọc đúng ≥ 98% ô tô rõ ràng, các ô mờ/không chắc chắn được đưa vào hàng đợi review thủ công thay vì tự động chấm sai.
- Không có trường hợp ghi đè dữ liệu câu hỏi làm sai lệch kết quả IRT lịch sử.
