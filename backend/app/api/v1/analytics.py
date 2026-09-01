from fastapi import APIRouter, HTTPException, Query
import pandas as pd
import os
import json
import numpy as np

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data")

def safe_float(val):
    try:
        if pd.isna(val) or val == "":
            return None
        return float(val)
    except:
        return None

def read_raw_students():
    filepath = os.path.join(DATA_DIR, "raw_students.csv")
    if not os.path.exists(filepath):
        return []
        
    df = pd.read_csv(filepath)
    # The header structure is complex:
    # Row 0: STT, Họ và tên, Thô, unnamed, IRT, unnamed, Thưởng phạt, unnamed
    # Row 1: unnamed, unnamed, Toán, TDKH, Toán, TDKH, Toán, TDKH
    # So we should skip row 1 for actual data and map columns manually.
    
    # Reload with header=None to manually parse
    df_raw = pd.read_csv(filepath, header=None)
    data_rows = df_raw.iloc[2:] # Data starts at row 2
    
    students = []
    for _, row in data_rows.iterrows():
        name = str(row[1]).strip()
        if pd.isna(name) or name == "nan" or name == "None":
            continue
            
        students.append({
            "stt": str(row[0]),
            "name": name,
            "tho_toan": safe_float(row[2]),
            "tho_tdkh": safe_float(row[3]),
            "irt_toan": safe_float(row[4]),
            "irt_tdkh": safe_float(row[5]),
            "phat_toan": safe_float(row[6]),
            "phat_tdkh": safe_float(row[7]),
        })
    return students

def read_responses():
    filepath = os.path.join(DATA_DIR, "raw_student_responses.csv")
    if not os.path.exists(filepath):
        return pd.DataFrame()
    return pd.read_csv(filepath)

@router.get("/students")
async def get_students(search: str = Query("", description="Tìm kiếm theo tên hoặc email")):
    students = read_raw_students()
    
    if search:
        search_lower = search.lower()
        students = [s for s in students if search_lower in s["name"].lower()]
        
    return {"items": students}

@router.get("/class-summary")
async def get_class_summary():
    students = read_raw_students()
    if not students:
        return {"total_students": 0, "avg_toan": 0, "avg_tdkh": 0}
        
    valid_toan = [s["irt_toan"] for s in students if s["irt_toan"] is not None]
    valid_tdkh = [s["irt_tdkh"] for s in students if s["irt_tdkh"] is not None]
    
    avg_toan = sum(valid_toan) / len(valid_toan) if valid_toan else 0
    avg_tdkh = sum(valid_tdkh) / len(valid_tdkh) if valid_tdkh else 0
    
    # Sort to find top
    sorted_students = sorted(
        [s for s in students if s["irt_toan"] is not None and s["irt_tdkh"] is not None],
        key=lambda x: x["irt_toan"] + x["irt_tdkh"],
        reverse=True
    )
    
    valedictorian = sorted_students[0] if len(sorted_students) > 0 else None
    salutatorian = sorted_students[1] if len(sorted_students) > 1 else None
    
    return {
        "total_students": len(students),
        "avg_toan": round(avg_toan, 2),
        "avg_tdkh": round(avg_tdkh, 2),
        "valedictorian": valedictorian,
        "salutatorian": salutatorian
    }

@router.get("/item-analysis")
async def get_item_analysis():
    df_resp = read_responses()
    if df_resp.empty:
        return {"items": []}
        
    q_cols = [f"Câu {i}" for i in range(1, 61)]
    analysis = []
    
    for q in q_cols:
        if q not in df_resp.columns:
            continue
            
        col_data = df_resp[q]
        
        # Count non-null
        total = len(df_resp)
        
        # Convert to numeric
        numeric_col = pd.to_numeric(col_data, errors='coerce')
        correct = (numeric_col > 0).sum()
        wrong = ((numeric_col == 0) | (numeric_col < 0)).sum()
        
        # Recalculate empty to be total - correct - wrong
        empty_count = total - correct - wrong
        
        analysis.append({
            "question": q,
            "correct_percent": round(correct / total * 100, 1) if total > 0 else 0,
            "wrong_percent": round(wrong / total * 100, 1) if total > 0 else 0,
            "empty_percent": round(empty_count / total * 100, 1) if total > 0 else 0,
            "correct_count": int(correct),
            "wrong_count": int(wrong),
            "empty_count": int(empty_count)
        })
        
    return {"items": analysis}

@router.get("/responses/{name_or_email}")
async def get_student_responses(name_or_email: str):
    df_resp = read_responses()
    if df_resp.empty:
        raise HTTPException(status_code=404, detail="No data")
        
    query = name_or_email.lower().strip()
    
    def match_row(row):
        name = str(row.get('Họ và tên', '')).lower()
        email = str(row.get('Email', '')).lower()
        return query in name or query in email
        
    mask = df_resp.apply(match_row, axis=1)
    matched = df_resp[mask]
    
    if matched.empty:
        raise HTTPException(status_code=404, detail="Student not found")
        
    row = matched.iloc[-1]
    
    q_cols = [f"Câu {i}" for i in range(1, 61)]
    responses = {}
    for q in q_cols:
        if q in row:
            val = row[q]
            if pd.isna(val):
                status = "empty"
            else:
                try:
                    num = float(val)
                    if num > 0:
                        status = "correct"
                    else:
                        status = "wrong"
                except:
                    status = "wrong"
            responses[q] = status
            
    return {
        "name": row.get('Họ và tên', ''),
        "email": row.get('Email', ''),
        "responses": responses
    }
