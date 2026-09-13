import cv2
import numpy as np

def debug_markers(image_path):
    image = cv2.imread(image_path)
    if image is None:
        print("Cannot read image")
        return
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    cv2.imwrite("C:/Users/LENOVO/.gemini/antigravity-ide/brain/tempmediaStorage/debug_thresh.jpg", thresh)
    
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    h, w = image.shape[:2]
    min_area = 500 * (h * w / (2000 * 2500))
    max_area = 50000 * (h * w / (2000 * 2500))
    
    debug_img = image.copy()
    valid_count = 0
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area or area > max_area:
            continue
            
        x, y, cw, ch = cv2.boundingRect(contour)
        aspect = cw / ch if ch > 0 else 0
        if not (0.7 <= aspect <= 1.4):
            continue
            
        hull = cv2.convexHull(contour)
        hull_area = cv2.contourArea(hull)
        solidity = area / hull_area if hull_area > 0 else 0
        if solidity < 0.7:
            continue
            
        valid_count += 1
        cv2.drawContours(debug_img, [contour], -1, (0, 255, 0), 2)
        print(f"Found valid marker: area={area:.1f}, aspect={aspect:.2f}, solidity={solidity:.2f}")

    print(f"Total valid markers: {valid_count}")
    cv2.imwrite("C:/Users/LENOVO/.gemini/antigravity-ide/brain/tempmediaStorage/debug_markers.jpg", debug_img)

debug_markers("C:/Users/LENOVO/.gemini/antigravity-ide/brain/6d036120-bebe-4313-86ed-fcef85ef21fd/.user_uploaded/media_1789272353522.jpg")
