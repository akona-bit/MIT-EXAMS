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
