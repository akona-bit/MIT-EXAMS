import json
import os

class OMREngine:
    def __init__(self, file_path: str):
        self.file_path = file_path
        
    def _convert_pdf_to_image(self):
        import fitz
        import numpy as np
        import cv2
        doc = fitz.open(self.file_path)
        page = doc.load_page(0) # Read first page
        pix = page.get_pixmap()
        img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        if pix.n == 4:
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2RGB)
        return img_array

    def process(self):
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"File not found: {self.file_path}")
            
        import cv2
        import numpy as np
        
        # 1. Load Image
        if self.file_path.lower().endswith('.pdf'):
            img = self._convert_pdf_to_image()
        else:
            img = cv2.imread(self.file_path)
            
        if img is None:
            raise ValueError("Failed to read image")
            
        # 2. Basic OpenCV Pipeline (Simulated)
        # Convert to grayscale, blur, threshold
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        # edged = cv2.Canny(blurred, 75, 200)
        
        # NOTE: Here we would find 4 corner markers, perform perspective transform,
        # extract ID/Form grid and 120 question grids.
        # Since this depends on an exact template, we simulate the output.
        
        import random
        student_id_raw = "123456"
        form_code_raw = "101"
        
        answers = {}
        for i in range(1, 121):
            choice = random.randint(1, 4)
            ratios = {1: 0.05, 2: 0.05, 3: 0.05, 4: 0.05}
            ratios[choice] = random.uniform(0.7, 0.95)
            
            # Inject ambiguous cases for review testing
            if i in [15, 42, 88]:
                ratios[choice] = 0.45 
                ratios[(choice % 4) + 1] = 0.40 
                
            answers[str(i)] = ratios
            
        needs_review = False
        for q, r in answers.items():
            for k, v in r.items():
                if 0.2 < v < 0.6:
                    needs_review = True
                    break
                    
        return {
            "student_id_raw": student_id_raw,
            "form_code_raw": form_code_raw,
            "answers_raw": json.dumps(answers),
            "confidence_score": 60.0 if needs_review else 95.0,
            "needs_review": needs_review
        }
