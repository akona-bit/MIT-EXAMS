import cv2
import numpy as np

def debug_bounding_box(image_path):
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    for contour in contours:
        area = cv2.contourArea(contour)
        if area > 100000:
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            print(f"Large contour area={area}, points={len(approx)}")
            if len(approx) == 4:
                print("Found the 4 corners!")
                for pt in approx:
                    print(pt[0])

debug_bounding_box("C:/Users/LENOVO/.gemini/antigravity-ide/brain/6d036120-bebe-4313-86ed-fcef85ef21fd/.user_uploaded/media_1789272353522.jpg")
