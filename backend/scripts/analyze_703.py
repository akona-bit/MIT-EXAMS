import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import posthog
import json
import os
import sys

# Add backend directory to path so we can import irt_engine
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(backend_dir)
from app.services.grading.irt_engine import mmle, theta_estimate

# Config
posthog.project_api_key = 'phc_dummy'
posthog.host = 'https://app.posthog.com'
DATA_DIR = r"d:\MIT\data"
OUTPUT_DIR = r"d:\MIT\data\plots"
OBSIDIAN_DIR = r"d:\MIT\.obsidian\knowledge"

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(OBSIDIAN_DIR, exist_ok=True)

def parse_penalty_weights(filepath):
    df = pd.read_csv(filepath)
    # The columns are: Phần thi, Câu hỏi, Số HS đã làm, Số HS làm đúng, Số HS làm sai, 
    # Phạt, Thưởng_1, Thưởng_2, Thưởng_3, Thưởng_Đúng, Ghi chú
    weights = {}
    current_part = None
    for idx, row in df.iterrows():
        if pd.notna(row.iloc[0]) and "thi" not in str(row.iloc[0]).lower():
            current_part = str(row.iloc[0]).strip()
            
        q_name = str(row.iloc[1]).strip()
        if not q_name.startswith("Câu"): continue
        
        phat = float(row.iloc[5]) if pd.notna(row.iloc[5]) else 0.0
        
        thuong_1 = float(row.iloc[6]) if len(row) > 6 and pd.notna(row.iloc[6]) else 0.0
        thuong_2 = float(row.iloc[7]) if len(row) > 7 and pd.notna(row.iloc[7]) else 0.0
        thuong_3 = float(row.iloc[8]) if len(row) > 8 and pd.notna(row.iloc[8]) else 0.0
        thuong_dung = float(row.iloc[9]) if len(row) > 9 and pd.notna(row.iloc[9]) else 0.0
        
        weights[q_name] = {
            "part": current_part,
            "phat": phat,
            "thuong_1": thuong_1,
            "thuong_2": thuong_2,
            "thuong_3": thuong_3,
            "thuong_dung": thuong_dung
        }
    return weights

def calculate_penalty_score(u, weight):
    if pd.isna(u) or u == 0:
        return weight['phat']
    elif u == 1:
        return weight['thuong_dung']
    elif u == 0.1:
        return weight['thuong_1']
    elif u == 0.25 or u == 0.5:
        # Data has 0.25 and 0.5 for partial credit
        if u == 0.25:
            return weight['thuong_2']
        if u == 0.5:
            return weight['thuong_3']
    return 0.0

def main():
    print("1. Loading Data...")
    df_resp = pd.read_csv(os.path.join(DATA_DIR, "raw_student_responses.csv"))
    df_weights = parse_penalty_weights(os.path.join(DATA_DIR, "KẾT QUẢ KHẢO SÁT - Trọng số thưởng_phạt.csv"))
    
    # Filter 703 students
    # Data has headers at row 0 (index 0 is a duplicate header perhaps)
    df_resp = df_resp[df_resp['Email'].notna() & (df_resp['Email'] != 'Email')]
    print(f"Total students found: {len(df_resp)}")
    
    # Cột câu hỏi: "Câu 1" to "Câu 60"
    q_cols = [f"Câu {i}" for i in range(1, 61)]
    
    # Xử lý Câu 4 Lỗi Đề Thi -> Đúng hết
    if 'Câu 4' in df_resp.columns:
        df_resp['Câu 4'] = 1.0
        
    print("2. Calculating Penalty Scores and preparing IRT Matrices...")
    math_cols = [f"Câu {i}" for i in range(1, 31)]
    sci_cols = [f"Câu {i}" for i in range(31, 61)]
    
    math_scores = []
    sci_scores = []
    
    U_math = []
    U_sci = []
    
    for idx, row in df_resp.iterrows():
        m_score = 15.0
        s_score = 15.0
        
        u_m = []
        u_s = []
        
        for q in math_cols:
            if q not in row or q not in df_weights: 
                u_m.append(-1)
                continue
            val = row[q]
            try:
                val = float(val)
                m_score += calculate_penalty_score(val, df_weights[q])
                u_m.append(val if pd.notna(val) else -1)
            except:
                m_score += df_weights[q]['phat']
                u_m.append(-1)
                
        for q in sci_cols:
            if q not in row or q not in df_weights: 
                u_s.append(-1)
                continue
            val = row[q]
            try:
                val = float(val)
                s_score += calculate_penalty_score(val, df_weights[q])
                u_s.append(val if pd.notna(val) else -1)
            except:
                s_score += df_weights[q]['phat']
                u_s.append(-1)
                
        math_scores.append(max(0, m_score))
        sci_scores.append(max(0, s_score))
        U_math.append(u_m)
        U_sci.append(u_s)
        
    df_resp['Math_Penalty_Score'] = math_scores
    df_resp['Sci_Penalty_Score'] = sci_scores
    
    U_math = np.array(U_math)
    U_sci = np.array(U_sci)
    
    # fill nan in U with -1
    U_math = np.nan_to_num(U_math, nan=-1)
    U_sci = np.nan_to_num(U_sci, nan=-1)
    
    print("3. Running IRT 2PL via mmle()...")
    # Tốc độ mmle khá tốn kém, nhưng ta sẽ chạy max_iter nhỏ gọn cho demo
    try:
        a_math, b_math = mmle(U_math, name="Toán", max_iter=20, verbose=True)
        theta_m = theta_estimate(U_math, list(zip(a_math, b_math)))
        theta_m = np.array(theta_m)
        
        a_sci, b_sci = mmle(U_sci, name="TDKH", max_iter=20, verbose=True)
        theta_s = theta_estimate(U_sci, list(zip(a_sci, b_sci)))
        theta_s = np.array(theta_s)
    except Exception as e:
        print(f"IRT engine exception: {e}")
        # fallback for debug
        a_math, b_math, theta_m = np.ones(30), np.zeros(30), np.zeros(len(U_math))
        a_sci, b_sci, theta_s = np.ones(30), np.zeros(30), np.zeros(len(U_sci))
        
    # Scale theta to 0-300
    df_resp['Math_IRT_Score'] = np.clip((theta_m + 3) / 6 * 300, 0, 300)
    df_resp['Sci_IRT_Score'] = np.clip((theta_s + 3) / 6 * 300, 0, 300)
    
    print("4. Generating Charts & Sending to PostHog...")
    # Plot Penalty vs IRT
    plt.figure(figsize=(10, 6))
    sns.scatterplot(x=df_resp['Math_Penalty_Score'], y=df_resp['Math_IRT_Score'])
    plt.title('Math: Penalty Score vs IRT True Score')
    plt.xlabel('Thưởng phạt (0-30)')
    plt.ylabel('IRT Score (0-300)')
    plt.savefig(os.path.join(OUTPUT_DIR, 'math_scatter.png'))
    plt.close()
    
    plt.figure(figsize=(10, 6))
    sns.histplot(df_resp['Math_IRT_Score'], bins=30, kde=True, color='blue', label='Math')
    sns.histplot(df_resp['Sci_IRT_Score'], bins=30, kde=True, color='green', label='Sci')
    plt.title('Phân bố điểm IRT (0-300)')
    plt.legend()
    plt.savefig(os.path.join(OUTPUT_DIR, 'irt_dist.png'))
    plt.close()
    
    for idx, row in df_resp.iterrows():
        try:
            posthog.capture(row['Email'], 'exam_processed', {
                'math_penalty': row['Math_Penalty_Score'],
                'sci_penalty': row['Sci_Penalty_Score'],
                'math_irt': row['Math_IRT_Score'],
                'sci_irt': row['Sci_IRT_Score']
            })
        except:
            pass
            
    print("5. Generating Obsidian Knowledge Markdown...")
    summary_md = f"""---
name: "Kết quả chấm thi đợt 1 (703 thí sinh)"
type: REPORT
tags: [IRT, Penalty, Report]
---

# Báo Cáo Phân Tích Dữ Liệu Thi

- **Tổng số thí sinh:** {len(df_resp)}
- **Điểm TB Toán (Thưởng/Phạt):** {np.mean(df_resp['Math_Penalty_Score']):.2f} / 30
- **Điểm TB TDKH (Thưởng/Phạt):** {np.mean(df_resp['Sci_Penalty_Score']):.2f} / 30
- **Điểm TB Toán (IRT):** {np.mean(df_resp['Math_IRT_Score']):.2f} / 300
- **Điểm TB TDKH (IRT):** {np.mean(df_resp['Sci_IRT_Score']):.2f} / 300

## Nhận Xét Tham Số Câu Hỏi (IRT)
"""
    
    for i in range(30):
        summary_md += f"- **Câu {i+1} (Toán)**: Độ phân biệt (a) = {a_math[i]:.2f}, Độ khó (b) = {b_math[i]:.2f}\n"
    for i in range(30):
        summary_md += f"- **Câu {i+31} (TDKH)**: Độ phân biệt (a) = {a_sci[i]:.2f}, Độ khó (b) = {b_sci[i]:.2f}\n"
        
    with open(os.path.join(OBSIDIAN_DIR, "bao-cao-phan-tich-703-thi-sinh.md"), "w", encoding="utf-8") as f:
        f.write(summary_md)
        
    df_resp.to_csv(os.path.join(DATA_DIR, "processed_703_results.csv"), index=False)
    print("Done! Data processed and charts saved.")

if __name__ == "__main__":
    main()
