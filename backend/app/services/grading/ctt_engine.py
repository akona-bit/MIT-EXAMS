import numpy as np
import pandas as pd
# point-biserial correlation
def cal_pbcc(true_group, false_group, std, id_value) -> float:
    if id_value <= 0.025:
        id_value = 0.025 - 1e-6  # Tránh chia cho 0
    elif id_value >= 0.925:
        id_value = 0.925 + 1e-6
    mean_diff = true_group.mean() - false_group.mean()
    r = (mean_diff / std) * np.sqrt(id_value * (1 - id_value))
    return r

# Tính xác suất CTT
def cal_diff(data: pd.DataFrame):
    b = pd.Series(dtype=float, index=data.drop(columns=['SBD', 'Raw', 'Null', 'MaDe', 'Gioi']).columns)
    for j in data.drop(columns=['SBD', 'Raw', 'Null', 'MaDe', 'Gioi']).columns:
        true = (data[j] == 1).sum()
        all = data.shape[0]
        #để index theo cột câu hỏi
        b[j] = true / all
    return b

# Tính độ phân biệt CTT
def cal_disc(data: pd.DataFrame):
    a = pd.Series(dtype=float, index=data.drop(columns=['SBD', 'Raw', 'Null', 'MaDe', 'Gioi']).columns)
    group = int(data.shape[0]*0.27)    # Chia lấy phân vị để tính độ phân biệt
    data_sorted = data.sort_values(by='Raw', ascending=False)
    
    upper, lower = data_sorted.head(group), data_sorted.tail(group)
    for j in data.drop(columns=['SBD', 'Raw', 'Null', 'MaDe', 'Gioi']).columns:
        U = upper[j].sum()
        L = lower[j].sum()
        a[j] = ((U - L) / group)
    return a

def b_category(b):
    if b > 0.9: return 'Rất dễ'
    if b > 0.75: return 'Dễ'
    if b > 0.6: return 'Tương đối dễ'
    if b > 0.4: return 'Bình thường'
    if b > 0.25: return 'Tương đối khó'
    if b > 0.1: return 'Khó'
    return 'Rất khó'

def a_category(a):
    if a <= 0: return 'Kém'
    if a <= 0.2: return 'Chưa tốt'
    if a <= 0.4: return 'Chấp nhận được'
    if a <= 0.6: return 'Tương đối tốt'
    if a <= 0.8: return 'Tốt'
    if a <= 1.0: return 'Rất tốt'
    return 'Quá tốt'

def label_distractor(points):
    """
    points: danh sách điểm point-biserial của các phương án sai (distractor)
    """
    count = sum(1 for p in points if p < 0)
    total = len(points)
    
    if total == 0: return "Không có dữ liệu"
    
    if count == total:
        return "Tốt"
    elif count >= total - 1 and total >= 3:
        return "Bình thường"
    elif count >= total - 2 and total >= 3:
        return "Yếu"
    return "Kém"

