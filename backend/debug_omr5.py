import cv2
import numpy as np

def order_corners(points):
    rect = np.zeros((4, 2), dtype="float32")
    s = points.sum(axis=1)
    rect[0] = points[np.argmin(s)]
    rect[2] = points[np.argmax(s)]
    diff = np.diff(points, axis=1)
    rect[1] = points[np.argmin(diff)]
    rect[3] = points[np.argmax(diff)]
    return rect

def debug_bounding_box2(image_path):
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    for contour in contours:
        area = cv2.contourArea(contour)
        if 200000 < area < 500000:  # Assuming this is our main box
            # Find the 4 corners of the contour
            pts = contour.reshape(-1, 2)
            s = pts.sum(axis=1)
            tl = pts[np.argmin(s)]
            br = pts[np.argmax(s)]
            diff = np.diff(pts, axis=1)
            tr = pts[np.argmin(diff)]
            bl = pts[np.argmax(diff)]
            
            print(f"Corners: TL={tl}, TR={tr}, BR={br}, BL={bl}")
            # Warp it to test
            src = np.array([tl, tr, br, bl], dtype="float32")
            dst = np.array([[0, 0], [1700, 0], [1700, 2200], [0, 2200]], dtype="float32")
            M = cv2.getPerspectiveTransform(src, dst)
            warped = cv2.warpPerspective(image, M, (1700, 2200))
            cv2.imwrite("C:/Users/LENOVO/.gemini/antigravity-ide/brain/tempmediaStorage/warped_test.jpg", warped)
            print("Warped saved.")

debug_bounding_box2("C:/Users/LENOVO/.gemini/antigravity-ide/brain/6d036120-bebe-4313-86ed-fcef85ef21fd/.user_uploaded/media_1789272353522.jpg")
