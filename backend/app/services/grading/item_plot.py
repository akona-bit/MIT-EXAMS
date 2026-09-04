import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from statsmodels.nonparametric.smoothers_lowess import lowess
from pygam import GAM, s

# tách thành 4 DataFrame tương ứng với 4 phần thì, mỗi phần 30 câu hỏi
def tach_phan(df_chamdiem):
    df_info = df_chamdiem[['SBD', 'MaDe', 'Gioi']]
    df_TV = pd.concat([df_info, df_chamdiem[[f'Cau{i}' for i in range(1, 31)]]], axis=1)
    df_TA = pd.concat([df_info, df_chamdiem[[f'Cau{i}' for i in range(31, 61)]]], axis=1)
    df_TO = pd.concat([df_info, df_chamdiem[[f'Cau{i}' for i in range(61, 91)]]], axis=1)
    df_KH = pd.concat([df_info, df_chamdiem[[f'Cau{i}' for i in range(91, 121)]]], axis=1)
    return df_TV, df_TA, df_TO, df_KH

# hàm tính điểm thô (số câu đúng) và đếm số câu thí sinh bỏ trống
def tinh_diem(df_chamdiem):
    df_chamdiem['Raw'] = df_chamdiem[[f'{i}' for i in df_chamdiem.columns if i.startswith('Cau')]].apply(lambda x: sum(x == 1), axis=1)
    df_chamdiem['Null'] = df_chamdiem[[f'{i}' for i in df_chamdiem.columns if i.startswith('Cau')]].apply(lambda x: sum(x == -1), axis=1)
    return df_chamdiem

# # Hàm chuyển đổi đáp án thành giá trị (0 là sai hoặc không làm, 1 là đúng, -1 là trống)
# def chamDiem(x, answer):
#     ma_de = x['MaDe']
#     row = answer.loc[answer['MaDe'] == ma_de]
    
#     for i in range(1, 121):
#         thi_sinh_dap_an = str(x.get(f'Cau{i}', '')).strip().upper()
        
#         # Lấy đáp án đúng nếu tồn tại
#         if not row.empty:
#             dap_an_dung = str(row.iloc[0].get(f'Cau{i}', '')).strip().upper()
#         else:
#             dap_an_dung = ''

#         # Xử lý các trường hợp đặc biệt
#         if pd.isna(dap_an_dung):     # Xử lý chặn trên và sai đề
#             x[f'Cau{i}'] = 1
#         elif pd.isna(x[f'Cau{i}']): # xử lý bỏ trống câu hỏi
#             x[f'Cau{i}'] = -1
#         else:
#             # Tách các đáp án đúng theo dấu /
#             cac_dap_an = [da.strip() for da in dap_an_dung.split('/')]
#             # Xử lý kết quả bài làm
#             x[f'Cau{i}'] = 1 if thi_sinh_dap_an in cac_dap_an else 0

#     return x

# Hàm chuyển đổi đáp án thành giá trị (0 là sai hoặc không làm, 1 là đúng, -1 là trống)
def chamDiem(x, answer):
    ma_de = x['MaDe']
    row = answer.loc[answer['MaDe'] == ma_de]
    
    # Kiểm tra xem đáp án có dùng định dạng [STT]-[Đáp án] không
    is_multi_format = False
    position_map = {}  # {stt_cau_goc: dap_an_dung}
    
    if not row.empty:
        # Kiểm tra ô đầu tiên có dữ liệu
        for i in range(1, 121):
            cell_val = str(row.iloc[0].get(f'Cau{i}', '')).strip()
            if '-' in cell_val:
                is_multi_format = True
                break
    
    if is_multi_format and not row.empty:
        # Parse toàn bộ đáp án: mỗi ô có dạng "STT-ĐÁP_ÁN"
        # Cau{i} trong file đáp án = vị trí thứ i trong đề này
        # Giá trị = "STT_GỐC-ĐÁP_ÁN"
        col_to_original = {}  # {col_index_trong_de_nay: (stt_goc, dap_an)}
        for i in range(1, 121):
            cell_val = str(row.iloc[0].get(f'Cau{i}', '')).strip()
            if '-' in cell_val:
                parts = cell_val.split('-', 1)
                try:
                    stt_goc = int(parts[0].strip())
                    dap_an = parts[1].strip().upper()
                    col_to_original[i] = (stt_goc, dap_an)
                except (ValueError, IndexError):
                    col_to_original[i] = (i, '')
            elif cell_val and cell_val != 'NAN':
                col_to_original[i] = (i, cell_val.upper())
            else:
                col_to_original[i] = (i, '')
        
        # Đọc bài làm thí sinh theo vị trí cột (Cau1..Cau120)
        # rồi map về câu gốc để chấm
        # Kết quả ghi vào cột theo STT GỐC
        
        # Thu thập đáp án thí sinh theo vị trí cột
        thi_sinh_answers = {}  # {col_index: dap_an_thi_sinh}
        for i in range(1, 121):
            val = x.get(f'Cau{i}', '')
            if pd.isna(val) or str(val).strip() == '':
                thi_sinh_answers[i] = None
            else:
                thi_sinh_answers[i] = str(val).strip().upper()
        
        # Reset tất cả cột về -1 (mặc định bỏ trống)
        result = {}
        for i in range(1, 121):
            result[i] = -1
        
        # Chấm điểm: duyệt theo cột đề này
        for col_i, (stt_goc, dap_an_dung) in col_to_original.items():
            if stt_goc < 1 or stt_goc > 120:
                continue
            
            thi_sinh_dap_an = thi_sinh_answers.get(col_i)
            
            if not dap_an_dung or dap_an_dung == 'NAN':
                # Không có đáp án → câu đó tất cả được điểm
                result[stt_goc] = 1
            elif thi_sinh_dap_an is None:
                # Thí sinh bỏ trống
                result[stt_goc] = -1
            else:
                cac_dap_an = [da.strip() for da in dap_an_dung.split('/')]
                result[stt_goc] = 1 if thi_sinh_dap_an in cac_dap_an else 0
        
        # Ghi kết quả vào x theo STT GỐC
        for stt_goc, diem in result.items():
            x[f'Cau{stt_goc}'] = diem
    
    else:
        # Định dạng cũ (1 đề, không có mapping) → dùng logic gốc
        for i in range(1, 121):
            thi_sinh_dap_an = str(x.get(f'Cau{i}', '')).strip().upper()
            
            if not row.empty:
                dap_an_dung = str(row.iloc[0].get(f'Cau{i}', '')).strip().upper()
            else:
                dap_an_dung = ''
            
            if pd.isna(x.get(f'Cau{i}', float('nan'))) or row.empty:
                if row.empty or pd.isna(row.iloc[0].get(f'Cau{i}', float('nan'))):
                    x[f'Cau{i}'] = 1
                else:
                    x[f'Cau{i}'] = -1
            else:
                if not dap_an_dung or dap_an_dung == 'NAN':
                    x[f'Cau{i}'] = 1
                elif pd.isna(x[f'Cau{i}']):
                    x[f'Cau{i}'] = -1
                else:
                    cac_dap_an = [da.strip() for da in dap_an_dung.split('/')]
                    x[f'Cau{i}'] = 1 if thi_sinh_dap_an in cac_dap_an else 0
    
    return x

def ketQuaCham(df, answer):
    df_chamdiem = df.copy()
    df_chamdiem = df_chamdiem.apply(lambda x: chamDiem(x, answer), axis=1)
    return df_chamdiem

# Vẽ biểu đồ thành phần 
def draw_plot(df, col_name: str, title: str, range):
    sns.set_theme(style="whitegrid")
    plt.rcParams['font.family'] = 'serif'  # or 'sans-serif', 'monospace', 'cursive', 'fantasy'
    plt.rcParams['font.serif'] = ['Times New Roman'] 
    fig, axes = plt.subplots(ncols=2, nrows=2, figsize=(16, 8))

    sns.histplot(df[f'{col_name}TV'], bins=30, binrange=range, ax=axes[0, 0], kde=False, color="b")
    axes[0, 0].set_xlabel('Tiếng Việt')
    axes[0, 0].set_ylabel('Số lượng')
    #thêm giá trị vào từng cột
    for p in axes[0, 0].patches:
        height = p.get_height()
        if height > 0:
            axes[0, 0].annotate(f'{int(height)}', 
                             (p.get_x() + p.get_width() / 2., height),
                             ha='center', va='bottom', fontsize=12)
    axes[0,0].set_xlim(range[0], range[1])

    sns.histplot(df[f'{col_name}TA'], bins=30, binrange=range, ax=axes[0, 1], kde=False, color="r")
    axes[0, 1].set_xlabel('Tiếng Anh')
    axes[0, 1].set_ylabel('Số lượng')
    for p in axes[0, 1].patches:
        height = p.get_height()
        if height > 0:
            axes[0, 1].annotate(f'{int(height)}', 
                             (p.get_x() + p.get_width() / 2., height),
                             ha='center', va='bottom', fontsize=12)
    axes[0,1].set_xlim(range[0], range[1])

    sns.histplot(df[f'{col_name}TO'], bins=30, binrange=range, ax=axes[1, 0], kde=False, color="orange")
    axes[1, 0].set_xlabel('Toán')
    axes[1, 0].set_ylabel('Số lượng')
    for p in axes[1, 0].patches:   
        height = p.get_height()
        if height > 0:
            axes[1, 0].annotate(f'{int(height)}', 
                             (p.get_x() + p.get_width() / 2., height),
                             ha='center', va='bottom', fontsize=12)
    axes[1,0].set_xlim(range[0], range[1])

    sns.histplot(df[f'{col_name}KH'], bins=30, binrange=range, ax=axes[1, 1], kde=False, color="g")
    axes[1, 1].set_xlabel('Tư duy khoa học')
    axes[1, 1].set_ylabel('Số lượng')
    for p in axes[1, 1].patches:
        height = p.get_height()
        if height > 0:
            axes[1, 1].annotate(f'{int(height)}', 
                             (p.get_x() + p.get_width() / 2., height),
                             ha='center', va='bottom', fontsize=12)
    axes[1,1].set_xlim(range[0], range[1])

    fig.suptitle(title, fontsize=14)
    plt.tight_layout()
    plt.xlim(range[0], range[1])
    plt.show()

def plot_total(data: pd.DataFrame, range, title: str, xlabel: str, ylabel: str, lim, color):
    sns.set_theme(style="whitegrid")
    plt.figure(figsize=(10,5))
    plt.rcParams['font.family'] = 'serif'
    plt.rcParams['font.serif'] = ['Times New Roman'] 

    sns.histplot(data, bins=24, binrange=range, kde=True, color=color)
    #thêm giá trị vào từng cột
    for p in plt.gca().patches:
        height = p.get_height()
        if height > 0:
            plt.gca().annotate(f'{int(height)}', 
                            (p.get_x() + p.get_width() / 2., height),
                            ha='center',va='bottom', fontsize=10)

    plt.title(title)
    plt.xlabel(xlabel)
    plt.ylabel(ylabel)
    plt.xlim(lim[0], lim[1])

def plot_item(data_1, data_2, data_3, data_4, title, order, palette, size):
    sns.set_style("whitegrid")

    plt.rcParams['font.family'] = 'serif'
    plt.rcParams['font.serif'] = ['Times New Roman']

    plt.figure(figsize=size)

    data1 = data_1.copy()
    data2 = data_2.copy()
    data3 = data_3.copy()
    data4 = data_4.copy()

    data1["Đề"] = "Đề 1"
    data2["Đề"] = "Đề 2"
    data3["Đề"] = "Đề 3"
    data4["Đề"] = "Đề 4"

    merged = pd.concat(
        [data1, data2, data3, data4],
        ignore_index=True
    )

    sns.countplot(
        data=merged,
        x='Phân loại',
        palette=palette,
        order=order,
        hue='Đề'
    )

    plt.title(title, fontsize=14)
    plt.xlabel(None)
    plt.ylabel('Số lượng')

    # thêm nhãn trên mỗi cột
    for p in plt.gca().patches:
        height = p.get_height()

        if height > 0:
            plt.gca().annotate(
                f'{int(height)}',
                (
                    p.get_x() + p.get_width() / 2,
                    height
                ),
                ha='center',
                va='bottom',
                fontsize=10
            )

    plt.tight_layout()
    plt.show()


def oxy_item(item_params, title):
    sns.set_theme(style="whitegrid")
    plt.figure(figsize=(24, 12))
    plt.rcParams['font.family'] = 'serif'
    plt.rcParams['font.serif'] = ['Times New Roman'] 
    # Scatter plots
    plt.scatter(y=item_params['a'].iloc[0:30], x=item_params['b'].iloc[0:30], color='b', label='Tiếng Việt')
    plt.scatter(y=item_params['a'].iloc[30:60], x=item_params['b'].iloc[30:60], color='r', label='Tiếng Anh')
    plt.scatter(y=item_params['a'].iloc[60:90], x=item_params['b'].iloc[60:90], color='orange', label='Toán')
    plt.scatter(y=item_params['a'].iloc[90:120], x=item_params['b'].iloc[90:120], color='g', label='Tư duy khoa học')

    # Gán nhãn số câu
    for i in range(len(item_params)):
        plt.annotate(str(i+1), (item_params['b'].iloc[i], item_params['a'].iloc[i]), 
                    textcoords="offset pixels", xytext=(6, 6), ha='right')

    ax = plt.gca()
    ax.spines['left'].set_position('zero')
    ax.spines['bottom'].set_position('zero')

    ax.spines['right'].set_color('none')
    ax.spines['top'].set_color('none')

    ax.xaxis.set_ticks_position('bottom')
    ax.yaxis.set_ticks_position('left')

    plt.title(title, fontsize=16)
    plt.legend(title='Dạng câu hỏi')
    plt.grid(True, alpha=0.3)

def plot_one(ax, theta, right, title_txt, color:str, lim_low, lim_high):
        ax.scatter(theta, right, color=color, alpha=0.3)
        gam = GAM(s(0, n_splines=20)).fit(theta, right)
        # theta_grid = np.linspace(theta.min(), theta.max(), 300).reshape(-1, 1)
        pred_grid = np.linspace(lim_low, lim_high, 1000).reshape(-1, 1)
        raw_pred = gam.predict(pred_grid)         
        # vẽ đường cong fit
        # ax.plot(smoothed[:,0], smoothed[:,1], linewidth=2, color='black')
        ax.plot(pred_grid, raw_pred, linewidth=2, color=color)

        ax.set_title(title_txt)
        ax.set_xlabel("Theta")
        ax.set_ylabel("Điểm thô")
        ax.set_xlim(lim_low,lim_high)
        ax.set_ylim(0, 32)

def draw_box_plot(
    data_1, data_2, data_3, data_4,
    x, y,
    pallete_1, pallete_2, pallete_3, pallete_4,
    title
):
    # Layout 2x2, kích thước 12x12
    fig, axes = plt.subplots(2, 2, figsize=(12, 12))
    axes = axes.flatten()

    # Đề 1
    sns.boxplot(
        data=data_1,
        x=x,
        y=y,
        palette=pallete_1,
        ax=axes[0]
    )
    axes[0].set_title('Đề 1')
    axes[0].set_xlabel(None)

    # Đề 2
    sns.boxplot(
        data=data_2,
        x=x,
        y=y,
        palette=pallete_2,
        ax=axes[1]
    )
    axes[1].set_title('Đề 2')
    axes[1].set_xlabel(None)

    # Đề 3
    sns.boxplot(
        data=data_3,
        x=x,
        y=y,
        palette=pallete_3,
        ax=axes[2]
    )
    axes[2].set_title('Đề 3')
    axes[2].set_xlabel(None)

    # Đề 4
    sns.boxplot(
        data=data_4,
        x=x,
        y=y,
        palette=pallete_4,
        ax=axes[3]
    )
    axes[3].set_title('Đề 4')
    axes[3].set_xlabel(None)

    plt.suptitle(title, fontsize=14, y=0.98)
    plt.tight_layout()
    plt.show()