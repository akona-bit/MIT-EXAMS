import json
import os
import httpx
import google.generativeai as genai
from typing import Dict, Any

class OMREngine:
    def __init__(self, file_path: str):
        self.file_path = file_path
        
    def _get_file_bytes(self) -> bytes:
        if self.file_path.startswith("http://") or self.file_path.startswith("https://"):
            response = httpx.get(self.file_path, timeout=30.0)
            response.raise_for_status()
            return response.content
        else:
            if not os.path.exists(self.file_path):
                raise FileNotFoundError(f"File not found: {self.file_path}")
            with open(self.file_path, "rb") as f:
                return f.read()

    def _convert_pdf_to_image(self, file_bytes: bytes) -> bytes:
        import fitz
        import cv2
        import numpy as np
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page = doc.load_page(0)
        pix = page.get_pixmap()
        img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        if pix.n == 4:
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2RGB)
        # Convert back to jpeg bytes
        success, encoded_image = cv2.imencode('.jpg', img_array)
        if not success:
            raise ValueError("Could not encode image from PDF")
        return encoded_image.tobytes()

    def process(self) -> Dict[str, Any]:
        file_bytes = self._get_file_bytes()
        
        # 1. Prepare Image Bytes
        if self.file_path.lower().split('?')[0].endswith('.pdf'):
            image_bytes = self._convert_pdf_to_image(file_bytes)
        else:
            image_bytes = file_bytes
            
        # 2. Setup Gemini Model
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        if not gemini_api_key:
            raise ValueError("GEMINI_API_KEY chưa được cấu hình trên server.")
            
        genai.configure(api_key=gemini_api_key)
        
        model = genai.GenerativeModel(
            model_name='gemini-1.5-pro',
            generation_config={"response_mime_type": "application/json"}
        )
        
        prompt = """
        Bạn là một hệ thống chấm thi trắc nghiệm OMR tự động.
        Hãy phân tích ảnh chụp phiếu trả lời trắc nghiệm chuẩn (120 câu) và trích xuất dữ liệu.
        
        Trả về kết quả TỐI KỴ ĐỊNH DẠNG JSON sau:
        {
          "student_id": "string (chính xác 6 chữ số)",
          "form_code": "string (chính xác 3 chữ số)",
          "answers": {
            "1": "A hoặc B hoặc C hoặc D hoặc UNCLEAR",
            "2": "A hoặc B hoặc C hoặc D hoặc UNCLEAR",
            ... (cho đến 120)
          }
        }
        
        Quy tắc bắt buộc:
        1. "student_id" phải gồm 6 chữ số (từ ô tô tương ứng).
        2. "form_code" phải gồm 3 chữ số (từ ô tô tương ứng).
        3. Trong phần "answers", các key phải là chuỗi từ "1" đến "120".
        4. Value của mỗi câu hỏi chỉ được phép là "A", "B", "C", "D".
        5. Nếu một câu có nhiều hơn 1 lựa chọn được tô đen, hoặc tô quá mờ, hoặc bị tẩy xóa không rõ ràng, hãy trả về giá trị "UNCLEAR".
        6. Nếu ô trống hoàn toàn, cũng trả về "UNCLEAR".
        """
        
        # 3. Call Gemini Vision
        response = model.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": image_bytes}
        ])
        
        try:
            result_json = json.loads(response.text)
        except json.JSONDecodeError:
            raise ValueError(f"Gemini trả về chuỗi không phải JSON: {response.text}")
            
        student_id_raw = result_json.get("student_id", "")
        form_code_raw = result_json.get("form_code", "")
        answers_dict = result_json.get("answers", {})
        
        # 4. Map answers to Ratios
        choice_map = {"A": 1, "B": 2, "C": 3, "D": 4}
        processed_answers = {}
        needs_review = False
        
        # Verify length 6 and length 3 for IDs
        if len(student_id_raw) != 6 or not student_id_raw.isdigit():
            needs_review = True
            
        if len(form_code_raw) != 3 or not form_code_raw.isdigit():
            needs_review = True
            
        for i in range(1, 121):
            q_idx = str(i)
            ans = str(answers_dict.get(q_idx, "UNCLEAR")).strip().upper()
            
            ratios = {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0}
            
            if ans in choice_map:
                chosen = choice_map[ans]
                ratios[chosen] = 0.99
                # Add small background noise to others
                for k in ratios:
                    if k != chosen:
                        ratios[k] = 0.05
            else:
                # UNCLEAR -> 0.45 for all to trigger manual review
                ratios = {1: 0.45, 2: 0.45, 3: 0.45, 4: 0.45}
                needs_review = True
                
            processed_answers[q_idx] = ratios
            
        return {
            "student_id_raw": student_id_raw,
            "form_code_raw": form_code_raw,
            "answers_raw": json.dumps(processed_answers),
            "confidence_score": 60.0 if needs_review else 95.0,
            "needs_review": needs_review
        }
