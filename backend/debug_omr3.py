import cv2
import numpy as np

def debug_top_markers(image_path):
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    print("Objects with y < 400 and area > 100:")
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 100:
            continue
            
        x, y, cw, ch = cv2.boundingRect(contour)
        if y >= 400:
            continue
            
        aspect = cw / ch if ch > 0 else 0
        hull = cv2.convexHull(contour)
        hull_area = cv2.contourArea(hull)
        solidity = area / hull_area if hull_area > 0 else 0
        
        print(f"area={area:.1f}, aspect={aspect:.2f}, solidity={solidity:.2f}, pos=({x}, {y}) size=({cw}x{ch})")

debug_top_markers("C:/Users/LENOVO/.gemini/antigravity-ide/brain/6d036120-bebe-4313-86ed-fcef85ef21fd/.user_uploaded/media_1789272353522.jpg")
