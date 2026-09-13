import cv2
import numpy as np

def debug_markers_all(image_path):
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    markers = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 50:
            continue
            
        x, y, cw, ch = cv2.boundingRect(contour)
        aspect = cw / ch if ch > 0 else 0
        
        hull = cv2.convexHull(contour)
        hull_area = cv2.contourArea(hull)
        solidity = area / hull_area if hull_area > 0 else 0
        
        markers.append((area, aspect, solidity, x, y, cw, ch))
        
    # Sort by solidity > 0.8 and aspect near 1
    good = [m for m in markers if 0.8 <= m[2] <= 1.0 and 0.8 <= m[1] <= 1.2]
    good.sort(key=lambda x: x[0], reverse=True)
    
    print("Top 10 square-like objects:")
    for i, m in enumerate(good[:10]):
        print(f"[{i}] area={m[0]:.1f}, aspect={m[1]:.2f}, solidity={m[2]:.2f}, pos=({m[3]}, {m[4]}) size=({m[5]}x{m[6]})")

debug_markers_all("C:/Users/LENOVO/.gemini/antigravity-ide/brain/6d036120-bebe-4313-86ed-fcef85ef21fd/.user_uploaded/media_1789272353522.jpg")
