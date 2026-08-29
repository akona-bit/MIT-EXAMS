---
name: "Quy trình xử lý dữ liệu Thưởng Phạt và IRT (Knowledge & Prompt)"
type: NOTE
tags: [System, Workflow, IRT, PostHog]
---

# Tóm tắt Quy trình & Kiến thức Kết nối
*Tài liệu này được sinh ra tự động để lưu trữ cách hệ thống xử lý bài toán dữ liệu lớn với Cơ chế Thưởng Phạt và IRT 2PL.*

## 1. Context & Business Logic (Kiến thức kết nối)
- **Xử lý Dữ liệu Partial Credit:** Khác với IRT truyền thống chỉ nhận nhị phân (0/1), hệ thống MIT EXAMS có khả năng feed trực tiếp các trọng số thập phân từ cơ chế Thưởng/Phạt (0.1, 0.25, 0.5) vào hàm tính Log-Likelihood (`neg_log_likelihood` và thuật toán Gauss-Hermite `mmle()`). Điều này giúp phân loại năng lực cực kỳ chi tiết cho các câu hỏi True/False phức tạp.
- **Quy tắc Ngoại lệ (Hardcode Rule):** Câu 4 của đề thi được xác nhận là "Lỗi đề thi". Thuật toán được tinh chỉnh để bypass cơ chế chấm điểm và tự động gán `1.0` (đúng hoàn toàn) cho tất cả 703 thí sinh.
- **Mapping Dữ liệu (Thưởng/Phạt -> IRT):** 
  - *Điểm Thô (Thưởng Phạt)*: Tính bằng công thức `Tổng điểm thưởng + Tổng điểm phạt + 15` (Điểm base).
  - *Điểm IRT (True Score)*: Scale giá trị Năng lực ($\theta$) từ phân phối chuẩn (-3 đến +3) về thang điểm tuyệt đối `0 - 300` cho từng phần thi (Toán, Tư duy Khoa học).

## 2. Technical Implementation (Quy trình Python)
- **Script**: `backend/scripts/analyze_703.py`
- **Các bước thực thi**:
  1. Load dữ liệu từ `raw_student_responses.csv` và ma trận trọng số `KẾT QUẢ KHẢO SÁT - Trọng số thưởng_phạt.csv`.
  2. Parse điểm cho từng thí sinh dựa vào 4 mức thưởng (`thuong_1`, `thuong_2`, `thuong_3`, `thuong_dung`) và 1 mức phạt (`phat`).
  3. Load mảng 2 chiều $N \times J$ vào module `irt_engine.py` để train Marginal Maximum Likelihood Estimation (MMLE).
  4. Xuất các tham số $a_i$ (Độ phân biệt) và $b_i$ (Độ khó) lưu trữ tại hệ thống Knowledge Graph (Obsidian).
  5. Đồng bộ Event Tracking lên **PostHog** (`exam_processed`) với properties chứa cả điểm Penalty và điểm IRT.
  6. Render biểu đồ trực quan Histogram và Scatter plot lưu tại `data/plots/`.

## 3. Prompt Tái sử dụng (Dành cho Agent/Dev sau này)
> "Sử dụng script `analyze_703.py` để chạy pipeline chấm điểm kết hợp Thưởng Phạt và IRT 2 PL. Khi có dữ liệu mới, đảm bảo file CSV đầu vào có các cột từ `Câu 1` đến `Câu 60` chứa giá trị thập phân (0, 0.1, 0.25, 0.5, 1). Khởi chạy `python scripts/analyze_703.py` từ thư mục `backend`. Script sẽ tự động map ma trận trọng số, tính điểm 0-300 cho từng phần, gửi telemetry lên PostHog và sinh báo cáo tự động vào thư mục Obsidian."
