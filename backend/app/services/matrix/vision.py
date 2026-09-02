import os
from typing import List, Dict, Any
import google.generativeai as genai

# Cấu hình API key từ biến môi trường
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

class MatrixVisionService:
    @staticmethod
    async def parse_image_to_tsv(image_bytes: bytes) -> str:
        """
        Gửi ảnh lên Gemini Vision để nhận diện bảng ma trận đặc tả,
        buộc mô hình trả về định dạng TSV.
        """
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY chưa được cấu hình trên server.")
            
        model = genai.GenerativeModel('gemini-1.5-pro')
        
        prompt = """
        Bạn là một trợ lý ảo chuyên phân tích ảnh ma trận đề thi/đặc tả đề thi trắc nghiệm.
        Hãy đọc bảng trong ảnh và trích xuất dữ liệu ra định dạng TSV (Tab-Separated Values).
        
        Tuyệt đối không giải thích, không dùng markdown code block, chỉ in ra các dòng TSV.
        Dòng đầu tiên phải là header: topic\tconcept\tskill\tcount\tpart
        
        Lưu ý:
        1. Đối với các ô bị merge (trộn ô) kéo dài nhiều dòng, nếu không phân tách rõ được dòng nào bao nhiêu câu, hãy để chung vào 1 dòng và cộng dồn số câu, phần còn lại bạn không cần tự đoán, hệ thống của admin sẽ tự chia sau.
        2. Nếu không có đủ các cột topic, concept, skill thì hãy điền những gì đọc được, cột nào thiếu để trống.
        3. Cột part thường là 1 (Phần 1).
        
        Trả về kết quả TSV:
        """
        
        response = model.generate_content([
            prompt, 
            {"mime_type": "image/jpeg", "data": image_bytes}
        ])
        
        # Clean up markdown if model still returned it
        text = response.text.strip()
        if text.startswith("```tsv"):
            text = text[6:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        return text.strip()
