# tim_loi.py
file_path = r"D:\MIT\backend\app\services\exam_matrix_generator.py"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

depth = 0
found_negative = False

for line_idx, line in enumerate(lines, start=1):
    for char in line:
        if char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
            if depth < 0:
                print(
                    f"🚨 DẤU ĐÓNG NGOẶC THỪA TẠI DÒNG: {line_idx} (ký tự '{char}')"
                )
                print(f"👉 Nội dung dòng: {line.strip()}")
                depth = 0  # reset để tìm tiếp lỗi tiếp theo
                found_negative = True

if not found_negative:
    print("Không phát hiện đóng ngoặc âm cục bộ, toàn bộ ngoặc cân bằng.")