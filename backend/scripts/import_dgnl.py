import requests
import json

base_url = "http://localhost:8000/api/v1"
headers = {"X-User-Role": "ADMIN", "X-User-Id": "1"}

# 1. Create a matrix first
matrix_payload = {
    "name": "Ma trận ĐGNL từ File CSV",
    "description": "Ma trận được import tự động",
    "rules": []
}

res = requests.post(f"{base_url}/matrix/", json=matrix_payload, headers=headers)
if res.status_code != 200:
    print(res.json())
    exit(1)
matrix = res.json()
matrix_id = matrix["id"]

csv_content = """Mã,Kiến thức,,Số lượng,Ghi chú
A1.1.1,Cổ đại,Sử thi,2,Có thể có câu hỏi thuần lí thuyết (1 câu)
A1.1.2,,Thần thoại,,Các câu hỏi rơi vào mức 1 và 2
A1.2.1,Văn học sân khấu,Chèo,,
A1.2.2,,Tuồng,,
A1.3.1,Trung đại,Truyện truyền kì,2.5,"Bắt buộc phải có một câu hỏi mức 3 về thơ với motif:
- Giải thích từ ngữ, điển tích,...
- Liên hệ tư tưởng của chủ thể trữ tinh,... hoặc liên hệ hình ảnh con người trung đại"
A1.3.2,,Truyện thơ Nôm,,
A1.3.3,,"Văn tế, thất ngôn,...",,
A1.4.1,Văn xuôi,Tiểu thuyết,1,Một trong hai phải có câu hỏi mức 3
A1.4.2,,Truyện ngắn,1,
A1.5.1,Thơ,Thơ cận đại,2.5,"Phải có một câu hỏi mức 3 theo motif
- Phân tích chi tiết một hình ảnh/thông tin
- Phân tích tác dụng của một biện pháp nghệ thuật"
A1.5.2,,Thơ trữ tình hiện đại,,
A1.5.3,,Thơ Hồ Chí Minh - tác gia và tác phẩm,,
A1.6.1,Các thể loại kí,Tuỳ bút,1,Mức 1
A1.6.2,,"Kí, nhật kí",,
A1.6.3,,Tản văn,,
A1.7,Kịch (chung),,1,Mức 2
A2.1.1,Chỉnh tả,Nhận biết các từ/cụm đúng hoặc sai chính tả,1.5,
A2.1.2,,Xác định các câu có chứa từ/cụm từ sai chính tả,,
A2.1.3,,Tìm từ bị sai chính tả trong câu,,
A2.2.1,Chữa lỗi trong câu/từ,Sai quy chiếu,6,"Phải đảm bảo mỗi câu sẽ bao quát hỏi một lỗi.
Phải có ít nhất một câu hỏi theo motif:
- Tìm câu được viết đúng
- Phát hiện lỗi trong câu.
- Cho một câu có chứa lỗi sai, viết lại câu đúng với nghĩa không đổi."
A2.2.2,,Sai logic,,
A2.2.3,,Mơ hồ,,
A2.2.4,,Sai cách dùng từ,,
A2.2.5,,Thiếu chủ ngữ/vị ngữ,,
A2.3.1,Nghĩa hoặc cấu trúc của từ hoặc câu,Giải thích nghĩa của từ/cụm từ/câu,0.5,
A2.3.2,,"Từ ghép, từ láy, từ Hán Việt,...",,
A2.3.3,,"Xác định cấu trúc câu (Trạng ngữ, chủ ngữ, vị ngữ, khởi ngữ)",,
A2.4,Tri thức ngữ văn khác,,1,
A3.1.1,Văn bản thông tin,Xác định chủ đề chính,1,Thứ tự các câu hỏi nên trình bày tương ứng với thứ tự đọc từ trên xuống.
A3.1.2,,Xác định thái độ của tác giả ở từng đoạn,3,
A3.1.3,,Xác định nội dung đoạn,,
A3.1.4,,Xác định/hiểu ý hoặc nhận định của đoạn,,
A3.1.5,,Xác định trật tự trình bày của văn bản,,
A3.1.6,,Xác định/Đánh giá các biện pháp trình bày thông tin trong văn bản,,
A3.1.7,,Đánh giá/Suy luận tác động của văn bản cho người độc,1,
A3.1.8,,Suy luận thông điệp của văn bản,,
A3.2.1,Văn bản nghị luận (xã hội/văn học),Xác định luận đề/luận điểm/lí lẽ,1,
A3.2.2,,Xác định cách trình bày của luận đề/luận điểm,2,
A3.2.3,,Xác định nội dung đoạn,,
A3.2.4,,Xác định/Hiểu/Đánh giá cách trình bày luận điểm/lí lẽ/dẫn chứng,,
A3.2.5,,Xác định thao tác lập luận của văn bản,,
A3.2.6,,Hiểu/Đánh giá/Suy luận các biện pháp nghệ thuật mà tác giả sử dụng trong văn bản,2,
A3.2.7,,Hiểu/Suy luận quan điểm của tác giả thể hiện trong văn bản,,
A3.2.8,,Hiểu/Xác định/Suy luận cách tác giả trình bày và truyền tải thông điệp/luận điểm/lí lẽ,,
B1.1.1,Điền khuyết,Giới từ,1,
B1.1.2,,Verb form,1,
B1.1.3,,So sánh,1,
B1.1.4,,Word form,1,
B1.1.5,,Lượng từ,1,
B1.2.1,Tìm lỗi sai,Mạo từ,1,
B1.2.2,,Sở hữu,1,
B1.2.3,,Mệnh đề quan hệ,1,
B1.2.4,,Hoà hợp chủ-vị,1,
B1.2.5,,Động từ/tobe,1,
B1.3.1,Viết lại câu,Câu tường thuật,1,
B1.3.2,,"If/wish, thể giả định,...",1,
B1.3.3,,"So sánh (nhiều, nhất)",1,
B1.3.4,,Bị động (có dạng đặc biệt),1,"Câu hỏi phải đánh vào kiến thức ngữ pháp chuyên sâu, tập trung sử dụng các ngữ pháp phức tạp (đảo ngữ, câu chẻ)"
B1.3.5,,Modal verb/adverb,1,
B2.1.1,Đọc hiểu đời sống,Nội dung chính văn bản,1,Thứ tự các câu hỏi nên trình bày tương ứng với thứ tự đọc từ trên xuống.
B2.1.2,,Tìm từ liên quan đến đối tượng (refer to),1,
B2.1.3,,"Đọc, hiểu và nhận biết ý của một đoạn trong văn bản",2.5,
B2.1.4,,Tìm từ đồng/gần/trái nghĩa,1,
B2.1.5,,"Đọc, hiểu nội dung được đề cập hoặc liên hệ trong một đoạn của văn bản",1.5,
B2.1.6,,"Suy luận, vận dụng để loại đáp án liên quan đến nội dung của một đoạn trong văn bản",,
B2.2.1,Đọc hiểu học thuật,Đặt tiêu đề của văn bản,1,
B2.2.2,,Tìm từ/cụm từ liên quan đến đối tượng (refer to),1,
B2.2.3,,Giải thích nghĩa của một từ/cụm từ trong một đoạn của văn bản,1,
B2.2.4,,"Hiểu, suy luận mục đích tác giả sử dụng một từ ngữ trong ngữ cảnh của một đoạn văn",1,
B2.2.5,,"Đọc, hiểu và nhận biết ý của một đoạn trong văn bản",3,
B2.2.6,,"Đọc, hiểu nội dung được đề cập hoặc liên hệ trong một đoạn của văn bản",,
B2.2.7,,"Suy luận, vận dụng để loại đáp án liên quan đến nội dung của một đoạn trong văn bản",,
B2.2.8,,"Sắp xếp, suy luận, lựa chọn các ý/nội dung phù hợp với NHIỀU đoạn trong văn bản",1,
C1.1.1,"Nguyên hàm, tích phân",Các phép biển đổi cơ bản,1,
C1.1.2,,Ứng dụng của tích phân,1,
C1.2.1,Lý thuyết đồ thị,Tính liên thông của đồ thị,1,
C1.2.2,,Đường đi ngắn nhất,1,Câu hỏi bắt buộc phải có đồ thị đi kèm
C1.3.1,Hinh học phẳng,Định lý sin,2,"1 trong 2 câu phải có yếu tố liên quan đến xử lí và biến đổi lượng giác.
Bắt buộc phải có ít nhất 1 câu về hình học phẳng"
C1.3.2,,Định lý cos,,
C1.3.3,,Công thức heron,,
C1.3.4,,Hệ thức lượng trong tam giác,,
C1.4.1,Lượng giác,Biến đổi lượng giác,,
C1.4.2,,Phương trình lượng giác,,
C1.5.1,"Giới hạn, hàm số liên tục",Xét tính liên tục của hàm số,2,
C1.5.2,,Giới hạn,,
C1.6.1,Khảo sát hàm số,Đạo hàm,,
C1.6.2,,Tiệm cận của hàm số,,
C1.7.1,"Số mũ, logarit",(bất) Phương trình logarit/số mũ,2,
C1.7.2,,Biến đổi logarit/số mũ,,Bắt buộc
C1.7.3,,Bài toán lãi suất,,
C1.8.1,"Giải, xét dấu, biện luận phương trình/bất phương trình/Hệ phương trình",Phương trình chứa căn,2,1 trong 2 câu phải có yếu tố liên quan đến biện luận (tham số m)
C1.8.2,,Phương trình bậc 2 chia bậc 1,,
C1.8.3,,Tam thức bậc 2,,
C1.8.4,,Phương trình chứa trị tuyệt đối,,
C1.8.5,,Hệ phương trình,,
C2.1.1,Quy hoạch tuyến tính,Đưa ra biểu thức,2,"1 câu nhận biết phương trình, 1 câu tính toán"
C2.1.2,,Tính toán kết quả,,
C2.2.1,Hệ toạ độ Oxyz,Tính độ dài đoạn thẳng/khoảng cách,2,Cần phải có 1 câu hỏi có sử dụng các dữ kiện liên quan để tạo lập phương trình
C2.2.2,,Tính góc,,
C2.2.3,,Tim giao điểm/Xác định điểm,,
C2.2.4,,Phương trình đường thẳng,,
C2.2.5,,Phương trình mặt cầu,,
C2.2.6,,Phương trình mặt phẳng,,
C2.2.7,,Vị trí tương đối trong hệ trục,,
C2.2.8,,Tích vô hướng/Có hướng,,
C2.3.1,"Cấp số cộng/nhân, dãy số","Xác định công bội, công sai, cấp số, tổng,...",2,Câu cuối phải có yếu tố liên quan đến truy hồi/giới hạn
C2.3.2,,"Tính giới hạn của dãy số, cấp số",,
C2.3.3,,Truy hồi,,
C3.1.1,Hình học không gian,"Xác định góc, điểm, đoạn thẳng,...",3,Cần thiết kế các câu hỏi độc lập ý nhưng có liên kết (VD: dữ kiện của câu 1 có thể được sử dụng để giải nhanh cho câu 2)
C3.1.2,,Thể tích,,
C3.1.3,,Số đo góc,,
C3.1.4,,"Diện tích, chu vi,...",,
C3.1.5,,Khoảng cách,,
C3.2.1,Hệ toạ độ Oxy,Xác định toạ độ/điểm/góc...,3,Cần phải có 1 câu hỏi có sử dụng các dữ kiện liên quan để tạo lập phương trình
C3.2.2,,Tính toán vecto,,
C3.2.3,,Phương trình đường thẳng,,
C3.2.4,,Phương trình đường tròn,,
C3.2.5,,Tính độ dài đoạn thẳng/khoảng cách,,
C3.2.6,,Tính góc,,
C3.2.7,,Tích vô hướng,,
C3.2.8,,"Phép tịnh tiến, phép xoay,...",,
C3.3.1,Thống kê,"Quy tắc cộng, nhân",3,
C3.3.2,,Tổ hợp,,
C3.3.3,,Chỉnh hợp,,
C3.3.4,,Xác suất cổ điển,,
C3.3.5,,Xác suất có điều kiện/Bayes,,
C3.4.1,"Khảo sát hàm số (bậc 3, phân thức). Có thể có tham số","Cực trị, điểm cực trị,...",3,
C3.4.2,,"Min, max",,
C3.4.3,,"Giá trị lớn nhất, nhỏ nhất",,
C3.4.4,,Khoảng cách giữa các điểm cực trị,,
C3.4.5,,"Phương trình hoành độ giao điểm, tiếp tuyến, đồ thị hàm số giao nhau,...",,
D1.1.1,Tư duy logic,Logic sắp xếp đơn lẻ,3,"Chọn ngẫu nhiên một trong các nhóm câu hỏi.
Không nên để trùng lặp ý tưởng câu hỏi."
D1.1.2,,Logic có yếu tố nhiều nhóm (subgroup),3,
D2.1.1,PTSL,Bảng số liệu,3,
D2.1.2,,Bảng gom nhóm histogram,,
D2.1.3,,Bảng sơ đồ venn,3,
D2.2.1,,Biểu đồ cột,,
D2.2.2,,Biểu đồ tròn,,
D2.2.3,,Biểu đồ đường,,
D2.2.4,,Biểu đồ venn,,
D2.2.5,,Biểu đồ Hist,,
D3.1,SLKH,Hoá học,3,"Mỗi câu hỏi sẽ được gắn thêm đuổi .1 (nhận biết), .2 (thông hiểu), .3 (vận dụng)
Độ khó câu hỏi tăng dần.
Cần xây dựng các câu hỏi độc lập, hạn chế để trùng ý trên một vùng hoặc nhóm dữ liệu.
Không nên để trùng lặp ý tưởng câu hỏi."
D3.2,,Vật lí,3,
D3.3,,Sinh học,3,
D3.4,,Lịch sử,3,
D3.5,,Địa lí,3,
D3.6,,KTPL,3,
"""

preview_req = {
    "content": csv_content,
    "level_ratios": {},
    "type_ratios": {}
}

print(f"Previewing import for matrix {matrix_id}...")
preview_res = requests.post(f"{base_url}/matrix/{matrix_id}/import/preview", json=preview_req, headers=headers)
if preview_res.status_code != 200:
    print(preview_res.json())
    exit(1)
preview_data = preview_res.json()["preview"]
print(f"Preview generated {len(preview_data)} rows")

execute_req = {
    "confirmed_rows": preview_data,
    "strategy": "add"
}

print(f"Executing import for matrix {matrix_id}...")
exec_res = requests.post(f"{base_url}/matrix/{matrix_id}/import/execute", json=execute_req, headers=headers)
print(exec_res.json())

# Create Exam
exam_payload = {
    "name": "Đề thi tự động từ ma trận CSV",
    "description": "Auto generated",
    "duration_minutes": 150,
    "show_score_mode": "NONE",
    "show_answer_mode": "NONE",
    "allow_omr": False,
    "matrix_id": matrix_id
}
exam_res = requests.post(f"{base_url}/exams/", json=exam_payload, headers=headers)
exam_id = exam_res.json()["id"]
print(f"Created Exam {exam_id}")

# Generate Forms
gen_payload = {
    "exam_id": exam_id,
    "number_of_forms": 1,
    "distinct_questions": False
}
print(f"Generating forms for exam {exam_id} from matrix {matrix_id}...")
gen_res = requests.post(f"{base_url}/matrix/{matrix_id}/generate", json=gen_payload, headers=headers)
print(gen_res.json())

