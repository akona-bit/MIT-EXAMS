# Hướng dẫn Kiểm thử tải (Load Testing) với Locust

Dự án sử dụng **Locust** để kiểm thử khả năng chịu tải của API, đặc biệt là kịch bản nhiều thí sinh cùng nộp bài / chọn đáp án đồng thời.

## Cài đặt Locust
Locust là công cụ viết bằng Python. Cài đặt thông qua pip:
```bash
pip install locust
```

## Cách chạy
1. Đảm bảo backend đang chạy (VD: `http://localhost:8000`).
2. Mở terminal, di chuyển vào thư mục `load_test`.
3. Chạy lệnh:
```bash
locust -f locustfile.py
```
4. Mở trình duyệt truy cập: `http://localhost:8089` (Giao diện web của Locust).
5. Điền thông tin:
   - **Number of users**: Số lượng thí sinh mô phỏng (vd: 500)
   - **Spawn rate**: Số lượng thí sinh tăng lên mỗi giây (vd: 10)
   - **Host**: `http://localhost:8000` (URL của API)
6. Bấm **Start swarming** để bắt đầu.

## Lưu ý
Trước khi chạy thật, bạn cần cập nhật `MOCK_TOKEN_HERE` trong `locustfile.py` bằng một Token hợp lệ, hoặc viết hàm tự động gọi `/api/v1/auth/login` để lấy token ngẫu nhiên cho mỗi user.
