# PHÂN TÍCH CHẤT LƯỢNG CÂU HỎI CỦA CÁC ĐỀ THI CHUẨN HOÁ VÀ ĐÁNH GIÁ NĂNG LỰC THÍ SINH
*Dự án cá nhân kiêm đồ án môn học Phân tích dữ liệu (DS111)*

**Author:**

Thái Bình Dương - 23520356

Khoa Hệ thông thông tin

Trường Đại học Công nghệ thông tin - ĐHQG-HCM

`python
import matplotlib.font_manager
fonts = [f.name for f in matplotlib.font_manager.fontManager.ttflist]
print(fonts)

`

`python
!sudo apt-get install ttf-mscorefonts-installer
!rm ~/.cache/matplotlib -fr
`

`python
!pip install pygam
`

`python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import irt
import ctt
import item_plot as ip
from sklearn.linear_model import LinearRegression
from scipy.stats import pearsonr, skew, kurtosis
from sklearn.metrics import mean_squared_error, r2_score
`
Đọc dữ liệu

`python
df_dot1 = pd.read_csv("lan1.csv")
df_dot2 = pd.read_csv("lan2.csv")
df_dot3 = pd.read_csv("lan3.csv")
df_dot4 = pd.read_csv("lan4.csv")

da_1 = pd.read_csv("ans_1.csv", delimiter=";")
da_2 = pd.read_csv("ans_2.csv", delimiter=";")
da_3 = pd.read_csv("ans_3.csv", delimiter=";")
da_4 = pd.read_csv("ans_4.csv", delimiter=";")

df_dot1.drop_duplicates(subset=['Email'], keep='last', inplace=True)
df_dot2.drop_duplicates(subset=['Email'], keep='last', inplace=True)
df_dot3.drop_duplicates(subset=['Email'], keep='last', inplace=True)
df_dot4.drop_duplicates(subset=['Email'], keep='last', inplace=True)
`

`python
df_survey=pd.read_excel('KhaoSat_Cleaned.xlsx')
`
## Phân tích thống kê sơ bộ
### Số thí sinh tham gia dự thi

`python
print(f'Tổng số thí sinh thi đề 1: {df_dot1.shape[0]}')
print(f'Tổng số thí sinh thi đề 2: {df_dot2.shape[0]}')
print(f'Tổng số thí sinh thi đề 3: {df_dot3.shape[0]}')
print(f'Tổng số thí sinh thi đề 4: {df_dot4.shape[0]}')
`

`python
thisinh_1 = pd.Series(df_dot1['Email'])
thisinh_2 = pd.Series(df_dot2['Email'])
thisinh_3 = pd.Series(df_dot3['Email'])
thisinh_4 = pd.Series(df_dot4['Email'])

set1 = set(thisinh_1)
set2 = set(thisinh_2)
set3 = set(thisinh_3)
set4 = set(thisinh_4)

thisinh_all4 = set1 & set2 & set3 & set4
thisinh_only1 = set1 - set2 - set3 - set4
thisinh_only2 = set2 - set1 - set3 - set4
thisinh_only3 = set3 - set1 - set2 - set4
thisinh_only4 = set4 - set1 - set2 - set3


print('--- Thống kê thí sinh tham gia 4 đề ---')

print(f'Số thí sinh thi cả 4 đề: {len(thisinh_all4)}')

print(f'Số thí sinh chỉ thi đề 1: {len(thisinh_only1)}')
print(f'Số thí sinh chỉ thi đề 2: {len(thisinh_only2)}')
print(f'Số thí sinh chỉ thi đề 3: {len(thisinh_only3)}')
print(f'Số thí sinh chỉ thi đề 4: {len(thisinh_only4)}')

`

`python
gioi= pd.DataFrame(
    {'Đề 1': df_dot1['Gioi'],
    'Đề 2': df_dot2['Gioi'],
    'Đề 3': df_dot3['Gioi'],
    'Đề 4': df_dot4['Gioi']
},

)
`

`python
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

# Clear the font cache to ensure Matplotlib sees the new fonts
fm._rebuild() if hasattr(fm, '_rebuild') else None

# Set Times New Roman globally
plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.serif'] = 'Times New Roman'

`

`python
sns.set_style("whitegrid")
plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.serif'] = ['Times New Roman']
plt.figure(figsize=(8, 6))
sns.countplot(data=gioi.melt(var_name='Đề', value_name='Giới tính'), x='Đề', hue='Giới tính')
plt.title('Thống kê giới tính thí sinh theo đề thi', fontsize=14)
plt.xlabel(None)
plt.ylabel('Số lượng')
#thêm nhãn trên mỗi cột
for p in plt.gca().patches:
    height = p.get_height()
    if height > 0:
        plt.gca().annotate(f'{int(height)}', (p.get_x() + p.get_width() / 2, height),
                        ha='center', va='bottom', fontsize=10)

`

`python
# lập thành bảng thống kê
gioi_counts = gioi.apply(pd.Series.value_counts).astype(int)
gioi_counts
`
### Thực hiện chấm điểm thô (số câu đúng)
Chấm đáp án

`python
df_chamdiem_1 = ip.ketQuaCham(df_dot1, da_1)
print('Đã chấm điểm xong đề 1')
df_chamdiem_2 = ip.ketQuaCham(df_dot2, da_2)
print('Đã chấm điểm xong đề 2')
df_chamdiem_3 = ip.ketQuaCham(df_dot3, da_3)
print('Đã chấm điểm xong đề 3')
`

`python
df_dot4
`

`python
df_chamdiem_4 = pd.read_csv('df_chamdiem_4.csv').merge(df_dot4[['SBD', 'Email', 'Name', 'Gioi']], on='SBD', how='left')
df_chamdiem_4
`

`python
order_kho = ['Rất dễ', 'Dễ', 'Tương đối dễ', 'Bình thường', 'Tương đối khó', 'Khó','Rất khó']
order_pb  = ['Kém', 'Chưa tốt', 'Chấp nhận được', 'Tương đối tốt', 'Tốt', 'Rất tốt','Quá tốt']
order_nhieu = ["Kém", "Yếu", "Bình thường", "Tốt"]
`

`python
df_chamdiem_4[['Cau71', 'Cau72', 'Cau95']] =1
`
Thực hiện tính điểm thô

`python
df_TV1, df_TA1, df_TO1, df_KH1 = ip.tach_phan(df_chamdiem_1)
df_TV2, df_TA2, df_TO2, df_KH2 = ip.tach_phan(df_chamdiem_2)
df_TV3, df_TA3, df_TO3, df_KH3 = ip.tach_phan(df_chamdiem_3)
df_TV4, df_TA4, df_TO4, df_KH4 = ip.tach_phan(df_chamdiem_4)



for data in [df_TV1, df_TA1, df_TO1, df_KH1, df_TV2, df_TA2, df_TO2, df_KH2, df_TV3, df_TA3, df_TO3, df_KH3, df_TV4, df_TA4, df_TO4, df_KH4]:
    data = ip.tinh_diem(data)
`

`python
df_raw_1 = df_TV1[['SBD', 'Raw']].copy().rename({'Raw': 'RawTV'}, axis=1)

df_raw_1 = df_raw_1.merge(df_TA1[['SBD', 'Raw']].rename({'Raw': 'RawTA'}, axis=1), on='SBD', how='outer')
df_raw_1 = df_raw_1.merge(df_TO1[['SBD', 'Raw']].rename({'Raw': 'RawTO'}, axis=1), on='SBD', how='outer')
df_raw_1 = df_raw_1.merge(df_KH1[['SBD', 'Raw']].rename({'Raw': 'RawKH'}, axis=1), on='SBD', how='outer')
ip.draw_plot(df_raw_1, col_name='Raw', title='Phổ điểm thô - Đề 1', range=(1,30))
`

`python
df_raw_2 = df_TV2[['SBD', 'Raw']].copy().rename({'Raw': 'RawTV'}, axis=1)

df_raw_2 = df_raw_2.merge(df_TA2[['SBD', 'Raw']].rename({'Raw': 'RawTA'}, axis=1), on='SBD', how='outer')
df_raw_2 = df_raw_2.merge(df_TO2[['SBD', 'Raw']].rename({'Raw': 'RawTO'}, axis=1), on='SBD', how='outer')
df_raw_2 = df_raw_2.merge(df_KH2[['SBD', 'Raw']].rename({'Raw': 'RawKH'}, axis=1), on='SBD', how='outer')
ip.draw_plot(df_raw_2, col_name='Raw', title='Phổ điểm thô - Đề 2', range=(1,30))
`

`python
df_raw_3 = df_TV3[['SBD', 'Raw']].copy().rename({'Raw': 'RawTV'}, axis=1)

df_raw_3 = df_raw_3.merge(df_TA3[['SBD', 'Raw']].rename({'Raw': 'RawTA'}, axis=1), on='SBD', how='outer')
df_raw_3 = df_raw_3.merge(df_TO3[['SBD', 'Raw']].rename({'Raw': 'RawTO'}, axis=1), on='SBD', how='outer')
df_raw_3 = df_raw_3.merge(df_KH3[['SBD', 'Raw']].rename({'Raw': 'RawKH'}, axis=1), on='SBD', how='outer')

ip.draw_plot(df_raw_3, col_name='Raw', title='Phổ điểm thô - Đề 3', range=(1,30))
`

`python
df_raw_4 = df_TV4[['SBD', 'Raw']].copy().rename({'Raw': 'RawTV'}, axis=1)

df_raw_4 = df_raw_4.merge(df_TA4[['SBD', 'Raw']].rename({'Raw': 'RawTA'}, axis=1), on='SBD', how='outer')
df_raw_4 = df_raw_4.merge(df_TO4[['SBD', 'Raw']].rename({'Raw': 'RawTO'}, axis=1), on='SBD', how='outer')
df_raw_4 = df_raw_4.merge(df_KH4[['SBD', 'Raw']].rename({'Raw': 'RawKH'}, axis=1), on='SBD', how='outer')

ip.draw_plot(df_raw_4, col_name='Raw', title='Phổ điểm thô - Đề 4', range=(1,30))
`

`python
fig, axes = plt.subplots(2, 2, figsize=(16, 8))
axes = axes.flatten()

def plot_kde(ax, de_1, de_2, de_3, de_4, title, color):
        sns.kdeplot(
            x=de_1,
            color=color, fill=False, alpha=0.7, label="Đề 1", ax=ax
        )
        sns.kdeplot(
            x=de_2,
            color=color, fill=False, alpha=1.0, linestyle="--", label="Đề 2", ax=ax
        )
        sns.kdeplot(
            x=de_3,
            color=color, fill=False, alpha=1.0, linestyle=":", label="Đề 3", ax=ax
        )
        sns.kdeplot(
            x=de_4,
            color=color, fill=False, alpha=1.0, linestyle="-.", label="Đề 4", ax=ax
        )

        ax.set_xlabel('Số câu đúng')
        ax.set_xlim(1, 30)
        ax.set_ylabel("Mật độ")
        ax.set_title(f"{title}")
        ax.legend()

plot_kde(axes[0], df_TV1["Raw"], df_TV2["Raw"], df_TV3["Raw"], df_TV4["Raw"], "Tiếng Việt", color='b')
plot_kde(axes[1], df_TA1["Raw"], df_TA2["Raw"], df_TA3["Raw"], df_TA4["Raw"], "Tiếng Anh", color='r')
plot_kde(axes[2], df_TO1["Raw"], df_TO2["Raw"], df_TO3["Raw"], df_TO4["Raw"], "Toán", color='y')
plot_kde(axes[3], df_KH1["Raw"], df_KH2["Raw"], df_KH3["Raw"], df_KH4["Raw"], "Tư duy khoa học", color='g')

plt.suptitle('Phổ điểm thô theo từng phần thi', y=0.98)
plt.tight_layout()
plt.show()

`

`python
df_raw_1[['RawTV', 'RawTA', 'RawTO', 'RawKH']].describe()
`

`python
df_raw_2[['RawTV', 'RawTA', 'RawTO', 'RawKH']].describe()
`

`python
df_raw_3[['RawTV', 'RawTA', 'RawTO', 'RawKH']].describe()
`

`python
df_raw_4[['RawTV', 'RawTA', 'RawTO', 'RawKH']].describe()
`

`python
rawtotal_1 = pd.Series(df_TV1['Raw'] + df_TA1['Raw'] + df_TO1['Raw'] + df_KH1['Raw'])
rawtotal_2 = pd.Series(df_TV2['Raw'] + df_TA2['Raw'] + df_TO2['Raw'] + df_KH2['Raw'])
rawtotal_3 = pd.Series(df_TV3['Raw'] + df_TA3['Raw'] + df_TO3['Raw'] + df_KH3['Raw'])
rawtotal_4 = pd.Series(df_TV4['Raw'] + df_TA4['Raw'] + df_TO4['Raw'] + df_KH4['Raw'])
`

`python
ip.plot_total(rawtotal_1, title='Phổ điểm theo điểm thô - Đề 1', range=(1,120), color='navy', xlabel='Số câu đúng', ylabel='Số lượng', lim=(0, 120))
`

`python
ip.plot_total(rawtotal_2, title='Phổ điểm theo điểm thô - Đề 2', range=(1,120), color='purple', xlabel='Số câu đúng', ylabel='Số lượng', lim=(0, 120))
`

`python
ip.plot_total(rawtotal_3, title='Phổ điểm theo điểm thô - Đề 3', range=(1,120), color='grey', xlabel='Số câu đúng', ylabel='Số lượng', lim=(0, 120))
`

`python
ip.plot_total(rawtotal_4, title='Phổ điểm theo điểm thô - Đề 4', range=(1,120), color='brown', xlabel='Số câu đúng', ylabel='Số lượng', lim=(0, 120))
`
### Phân tích điểm TBHK các môn học

`python
fig, axes = plt.subplots(ncols=3, figsize=(18, 4))

parts = ['TV', 'TA', 'TO']

for i, part in enumerate(parts):
    sns.kdeplot(
        df_survey[f'{part}10_1'],
        ax=axes[i],
        label='HK1 - L10'
    )
    sns.kdeplot(
        df_survey[f'{part}10_2'],
        ax=axes[i],
        label='HK2 - L10'
    )
    sns.kdeplot(
        df_survey[f'{part}11_1'],
        ax=axes[i],
        label='HK1 - L11'
    )
    sns.kdeplot(
        df_survey[f'{part}11_2'],
        ax=axes[i],
        label='HK2 - L11'
    )

    axes[i].set_xlim(1, 10)
    axes[i].set_xlabel(f'TBHK - {part}')
    axes[i].set_ylabel('Mật độ')
    axes[i].legend()

plt.tight_layout()
plt.suptitle('Thống kê kết quả học tập của những học sinh có tham gia khảo sát', y=1.02)
plt.show()

`

`python
df_survey.describe()
`
## Phân tích theo lý thuyết khảo thí cổ điển
#### Độ khó

`python
diff_1, diff_2, diff_3, diff_4 = pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

# Đề 1
for data in [df_TV1, df_TA1, df_TO1, df_KH1]:
    b = ctt.cal_diff(data[data['Null'] < 30])
    diff_1 = pd.concat([diff_1, b], axis=0)

# Đề 2
for data in [df_TV2, df_TA2, df_TO2, df_KH2]:
    b = ctt.cal_diff(data[data['Null'] < 30])
    diff_2 = pd.concat([diff_2, b], axis=0)

# Đề 3
for data in [df_TV3, df_TA3, df_TO3, df_KH3]:
    b = ctt.cal_diff(data[data['Null'] < 30])
    diff_3 = pd.concat([diff_3, b], axis=0)

# Đề 4
for data in [df_TV4, df_TA4, df_TO4, df_KH4]:
     b = ctt.cal_diff(data[data['Null'] < 30])
     diff_4 = pd.concat([diff_4, b], axis=0)

# Đổi tên cột
diff_1 = diff_1.rename({0: 'CTT'}, axis=1)
diff_2 = diff_2.rename({0: 'CTT'}, axis=1)
diff_3 = diff_3.rename({0: 'CTT'}, axis=1)
diff_4 = diff_4.rename({0: 'CTT'}, axis=1)
`

`python
def b_category(diff):
    if diff > 0.9:
        return 'Rất dễ'
    elif diff > 0.75:
        return 'Dễ'
    elif diff > 0.6:
        return 'Tương đối dễ'
    elif diff > 0.4:
        return 'Bình thường'
    elif diff > 0.25:
        return 'Tương đối khó'
    elif diff > 0.1:
        return 'Khó'
    else:
        return 'Rất khó'

diff_1['Phân loại'] = diff_1['CTT'].apply(b_category)
diff_2['Phân loại'] = diff_2['CTT'].apply(b_category)
diff_3['Phân loại'] = diff_3['CTT'].apply(b_category)
diff_4['Phân loại'] = diff_4['CTT'].apply(b_category)
`

`python
ip.plot_item(diff_1, diff_2, diff_3, diff_4, title='Thống kê số lượng câu hỏi theo độ khó', order=order_kho, palette='Blues_d', size=(10,6))
`

`python
diff_1['Phần thi'] = (
    diff_1.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

diff_2['Phần thi'] = (
    diff_2.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

diff_3['Phần thi'] = (
    diff_3.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

diff_4['Phần thi'] = (
    diff_4.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)
`

`python
fig, axes = plt.subplots(2, 2, figsize=(16, 10))
axes = axes.flatten()

# =========================
# HÀM VẼ CHUNG
# =========================
def draw_countplot(ax, data, palette, title, order):
    sns.countplot(
        data=data,
        x='Phân loại',
        palette=palette,
        ax=ax,
        hue='Phần thi',
        order=order
    )

    ax.set_title(title)
    ax.set_ylabel('Số lượng')
    ax.set_xlabel(None)

    # Hiển thị số trên cột
    for p in ax.patches:
        height = p.get_height()

        if height > 0:
            ax.annotate(
                f'{int(height)}',
                (
                    p.get_x() + p.get_width() / 2,
                    height
                ),
                ha='center',
                va='bottom',
                fontsize=10
            )

    # Tự động ticks trục Y
    max_y = int(max([p.get_height() for p in ax.patches] or [0]))

    if max_y <= 10:
        step = 1
    elif max_y <= 30:
        step = 2
    else:
        step = 5

    ax.set_yticks(range(0, max_y + 1, step))


# =========================
# ĐỀ 1
# =========================
draw_countplot(
    axes[0],
    diff_1,
    'GnBu_d',
    'Đề 1',
    order=order_kho
)

# =========================
# ĐỀ 2
# =========================
draw_countplot(
    axes[1],
    diff_2,
    'YlGn_d',
    'Đề 2',
    order=order_kho
)

# =========================
# ĐỀ 3
# =========================
draw_countplot(
    axes[2],
    diff_3,
    'OrRd_d',
    'Đề 3',
    order=order_kho
)

# =========================
# ĐỀ 4
# =========================
draw_countplot(
    axes[3],
    diff_4,
    'PuRd_d',
    'Đề 4',
    order=order_kho
)

plt.suptitle(
    'Độ khó xét theo từng phần thi của mỗi đợt',
    fontsize=14,
    y=0.98
)

plt.tight_layout()
plt.show()
`

`python
ip.draw_box_plot(
    diff_1,
    diff_2,
    diff_3,
    diff_4,
    'Phần thi',
    'CTT',
    'Blues_d',
    'Purples_d',
    'Reds_d',
    'Greens_d',
    'Chênh lệch độ khó CTT theo từng phần thi của mỗi đợt'
)

`
#### Độ phân biệt

`python
disc_1, disc_2, disc_3, disc_4 =  pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), pd.DataFrame()
for data in [df_TV1, df_TA1, df_TO1, df_KH1]:
    data = ip.tinh_diem(data)
    a = (ctt.cal_disc(data[data['Null'] < 30])) # loại những thí sinh không thi 1 phần (bỏ toàn bộ câu hỏi của phần thi đó)
    disc_1 = pd.concat([disc_1, a], axis=0)

for data in [df_TV2, df_TA2, df_TO2, df_KH2]:
    data = ip.tinh_diem(data)
    a = (ctt.cal_disc(data[data['Null'] < 30])) # loại những thí sinh không thi 1 phần (bỏ toàn bộ câu hỏi của phần thi đó)
    disc_2 = pd.concat([disc_2, a], axis=0)

for data in [df_TV3, df_TA3, df_TO3, df_KH3]:
    data = ip.tinh_diem(data)
    a = (ctt.cal_disc(data[data['Null'] < 30])) # loại những thí sinh không thi 1 phần (bỏ toàn bộ câu hỏi của phần thi đó)
    disc_3 = pd.concat([disc_3, a], axis=0)

for data in [df_TV4, df_TA4, df_TO4, df_KH4]:
    data = ip.tinh_diem(data)
    a = (ctt.cal_disc(data[data['Null'] < 30])) # loại những thí sinh không thi 1 phần (bỏ toàn bộ câu hỏi của phần thi đó)
    disc_4 = pd.concat([disc_4, a], axis=0)

disc_1 = disc_1.rename({0: 'D-Index'}, axis=1)
disc_2 = disc_2.rename({0: 'D-Index'}, axis=1)
disc_3 = disc_3.rename({0: 'D-Index'}, axis=1)
disc_4 = disc_4.rename({0: 'D-Index'}, axis=1)

`

`python
def a_category(disc):
    if disc <= 0:
        return 'Kém'
    elif disc <= 0.20:
        return 'Chưa tốt'
    elif disc <= 0.40:
        return 'Chấp nhận được'
    elif disc <= 0.60:
        return 'Tương đối tốt'
    elif disc <= 0.80:
        return 'Tốt'
    elif disc <= 1.0:
        return 'Rất tốt'
    else:
        return 'Quá tốt'

disc_1['Phân loại'] = disc_1['D-Index'].apply(a_category)
disc_2['Phân loại'] = disc_2['D-Index'].apply(a_category)
disc_3['Phân loại'] = disc_3['D-Index'].apply(a_category)
disc_4['Phân loại'] = disc_4['D-Index'].apply(a_category)
`

`python
ip.plot_item(disc_1, disc_2, disc_3, disc_4, title='Thống kê số lượng câu hỏi theo độ phân biệt', order=order_pb, palette='Greens_d', size=(10,6))
`

`python
disc_1['Phần thi'] = (
    disc_1.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

disc_2['Phần thi'] = (
    disc_2.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

disc_3['Phần thi'] = (
    disc_3.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

disc_4['Phần thi'] = (
    disc_4.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)
`

`python
fig, axes = plt.subplots(2, 2, figsize=(16, 10))
axes = axes.flatten()

# =========================
# ĐỀ 1
# =========================
draw_countplot(
    axes[0],
    disc_1,
    'BuGn_d',
    'Đề 1',
    order=order_pb
)

# =========================
# ĐỀ 2
# =========================
draw_countplot(
    axes[1],
    disc_2,
    'RdPu_d',
    'Đề 2',
    order=order_pb
)

# =========================
# ĐỀ 3
# =========================
draw_countplot(
    axes[2],
    disc_3,
    'YlOrBr_d',
    'Đề 3',
    order=order_pb
)

# =========================
# ĐỀ 4
# =========================
draw_countplot(
    axes[3],
    disc_4,
    'PuBu_d',
    'Đề 4',
    order=order_pb
)

plt.suptitle(
    'Độ phân biệt xét theo từng phần thi của mỗi đợt',
    fontsize=14,
    y=0.98
)

plt.tight_layout()
plt.show()
`

`python
ip.draw_box_plot(disc_1, disc_2, disc_3, disc_4, 'Phần thi', 'D-Index', 'viridis_d', 'plasma_d', 'rocket', 'PuBu_d', 'Chênh lệch độ phân biệt CTT theo từng phần thi của mỗi đợt')
`
#### Độ nhiễu

`python
def do_nhieu(data: pd.DataFrame, chamdiem, answer: pd.DataFrame, start, end):
    # Merge 1 lần
    data = data.merge(chamdiem[['SBD', 'Raw', 'Null']], on='SBD', how='left')
    ans_row = answer.iloc[0]

    # Kiểm tra định dạng multi (có dấu '-' trong ô đáp án)
    is_multi_format = any(
        '-' in str(ans_row.get(f'Cau{i}', ''))
        for i in range(1, 121)
        if '-' in str(ans_row.get(f'Cau{i}', ''))
    )

    # Nếu là multi-format, build bảng map: {stt_goc: dap_an_dung}
    if is_multi_format:
        correct_map = {}  # {stt_goc: dap_an}
        for i in range(1, 121):
            cell_val = str(ans_row.get(f'Cau{i}', '')).strip()
            if '-' in cell_val:
                parts = cell_val.split('-', 1)
                try:
                    stt_goc = int(parts[0].strip())
                    dap_an = parts[1].strip().upper()
                    correct_map[stt_goc] = dap_an
                except (ValueError, IndexError):
                    correct_map[i] = ''
            elif cell_val and cell_val.upper() != 'NAN':
                correct_map[i] = cell_val.upper()

    # DataFrame lưu kết quả tổng hợp
    df_all = pd.DataFrame(columns=["A", "B", "C", "D", "Null", "Ans"])

    # Lọc thí sinh hợp lệ
    valid = data[data['Null'] < 30]

    for stt in range(start, end + 1):
        std = valid['Raw'].std()
        cau_col = f"Cau{stt}"

        # Lấy đáp án đúng theo định dạng
        if is_multi_format:
            correct = correct_map.get(stt, '')
        else:
            correct = str(ans_row.get(cau_col, '')).strip().upper()

        n_total = valid.shape[0]
        pbcc_dict = {}

        for opt in ["A", "B", "C", "D"]:
            true_group  = valid.loc[valid[cau_col] == opt, 'Raw']
            false_group = valid.loc[valid[cau_col] != opt, 'Raw']
            if true_group.shape[0] == 0 or false_group.shape[0] == 0:
                pb = np.nan
            else:
                p = true_group.shape[0] / valid[cau_col].shape[0]
                pb = ctt.cal_pbcc(true_group, false_group, std, p)

            pbcc_dict[opt] = pb

        true_group = valid.loc[valid[cau_col].isna(), 'Raw']
        false_group = valid.loc[valid[cau_col].notna(), 'Raw']
        count = true_group.shape[0]
        percent = count / n_total if n_total > 0 else 0
        pbcc_dict["Null"] = ctt.cal_pbcc(true_group, false_group, std, percent) if count > 0 and false_group.shape[0] > 0 else np.nan

        # PBCC của đáp án đúng
        pbcc_ans = pbcc_dict.get(correct, np.nan)

        df_all.loc[f'Cau{stt}'] = [
            pbcc_dict["A"],
            pbcc_dict["B"],
            pbcc_dict["C"],
            pbcc_dict["D"],
            pbcc_dict["Null"],
            pbcc_ans
        ]

    return df_all
`

`python
nhieu_1 = pd.concat([do_nhieu(data=df_dot1, answer=da_1, chamdiem=df_TV1, start=1, end=30),
                     do_nhieu(data=df_dot1, answer=da_1, chamdiem=df_TA1, start=31, end=60),
                    do_nhieu(data=df_dot1, answer=da_1, chamdiem=df_TO1, start=61, end=90),
                    do_nhieu(data=df_dot1, answer=da_1, chamdiem=df_KH1, start=91, end=120),], axis=0)
`

`python
nhieu_1
`

`python
nhieu_2 = pd.concat([
    do_nhieu(data=df_dot2, answer=da_2, chamdiem=df_TV2, start=1, end=30),
    do_nhieu(data=df_dot2, answer=da_2, chamdiem=df_TA2, start=31, end=60),
    do_nhieu(data=df_dot2, answer=da_2, chamdiem=df_TO2, start=61, end=90),
    do_nhieu(data=df_dot2, answer=da_2, chamdiem=df_KH2, start=91, end=120),
], axis=0)

`

`python
nhieu_2
`

`python
nhieu_3 = pd.concat([
    do_nhieu(data=df_dot3, answer=da_3, chamdiem=df_TV3, start=1, end=30),
    do_nhieu(data=df_dot3, answer=da_3, chamdiem=df_TA3, start=31, end=60),
    do_nhieu(data=df_dot3, answer=da_3, chamdiem=df_TO3, start=61, end=90),
    do_nhieu(data=df_dot3, answer=da_3, chamdiem=df_KH3, start=91, end=120),
], axis=0)
nhieu_3
`

`python
nhieu_4 = pd.concat([
    do_nhieu(data=df_dot4, answer=da_4, chamdiem=df_TV4, start=1, end=30),
    do_nhieu(data=df_dot4, answer=da_4, chamdiem=df_TA4, start=31, end=60),
    do_nhieu(data=df_dot4, answer=da_4, chamdiem=df_TO4, start=61, end=90),
    do_nhieu(data=df_dot4, answer=da_4, chamdiem=df_KH4, start=91, end=120),
], axis=0)
nhieu_4
`

`python
# hàm phân loại độ nhiễu câu hỏi
def label_distract(data):
    scale = 0
    for col in data.drop(columns='Ans').index:  # bỏ qua cột đáp án đúng
        if data[col] == data['Ans']:
            continue
        else:
            scale += (data[col]<0)
    if scale == 4:
        return "Tốt"
    elif scale == 3:
        return "Bình thường"
    elif scale == 2:
        return "Yếu"
    else:
        return "Kém"
`

`python
nhieu_1['Phân loại'] = nhieu_1.apply(label_distract, axis=1)
nhieu_1
`

`python
nhieu_2['Phân loại'] = nhieu_2.apply(label_distract, axis=1)
nhieu_2
`

`python
nhieu_3['Phân loại'] = nhieu_3.apply(label_distract, axis=1)
nhieu_3
`

`python
nhieu_4['Phân loại'] = nhieu_4.apply(label_distract, axis=1)
nhieu_4
`

`python
ip.plot_item(nhieu_1, nhieu_2, nhieu_3, nhieu_4, title='Thống kê số lượng câu hỏi theo mức độ nhiễu', order=order_nhieu, palette='Oranges_d', size=(8,6))
`

`python
nhieu_1['Phần thi'] = (
    nhieu_1.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

nhieu_2['Phần thi'] = (
    nhieu_2.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

nhieu_3['Phần thi'] = (
    nhieu_3.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)
`

`python
fig, axes = plt.subplots(2, 2, figsize=(16, 10))
axes = axes.flatten()

# =========================
# ĐỀ 1
# =========================
draw_countplot(
    axes[0],
    nhieu_1,
    'flare_d',
    'Đề 1',
    order=order_nhieu
)

# =========================
# ĐỀ 2
# =========================
draw_countplot(
    axes[1],
    nhieu_2,
    'crest_d',
    'Đề 2',
    order=order_nhieu
)

# =========================
# ĐỀ 3
# =========================
draw_countplot(
    axes[2],
    nhieu_3,
    'bone_r',
    'Đề 3',
    order=order_nhieu
)

# =========================
# ĐỀ 4
# =========================
draw_countplot(
    axes[3],
    nhieu_4,
    'mako',
    'Đề 4',
    order=order_nhieu
)

plt.suptitle(
    'Độ nhiễu xét theo từng phần thi của mỗi đợt',
    fontsize=14,
    y=0.98
)

plt.tight_layout()
plt.show()
`

`python
item_ctt_1 = pd.concat([
    diff_1.rename(columns={'Phân loại': 'Độ khó'}).drop(columns='Phần thi'),
    disc_1.rename(columns={'Phân loại': 'Độ phân biệt'}).drop(columns='Phần thi'),
    nhieu_1.rename(columns={'Phân loại': 'Độ nhiễu'}).drop(columns='Phần thi')
], axis=1)

item_ctt_2 = pd.concat([
    diff_2.rename(columns={'Phân loại': 'Độ khó'}).drop(columns='Phần thi'),
    disc_2.rename(columns={'Phân loại': 'Độ phân biệt'}).drop(columns='Phần thi'),
    nhieu_2.rename(columns={'Phân loại': 'Độ nhiễu'}).drop(columns='Phần thi')
], axis=1)

item_ctt_3 = pd.concat([
    diff_3.rename(columns={'Phân loại': 'Độ khó'}).drop(columns='Phần thi'),
    disc_3.rename(columns={'Phân loại': 'Độ phân biệt'}).drop(columns='Phần thi'),
    nhieu_3.rename(columns={'Phân loại': 'Độ nhiễu'}).drop(columns='Phần thi')
], axis=1)

item_ctt_4 = pd.concat([
    diff_4.rename(columns={'Phân loại': 'Độ khó'}).drop(columns='Phần thi'),
    disc_4.rename(columns={'Phân loại': 'Độ phân biệt'}).drop(columns='Phần thi'),
    nhieu_4.rename(columns={'Phân loại': 'Độ nhiễu'}).drop(columns='Phần thi')
], axis=1)
`

`python
item_ctt_1, item_ctt_2, item_ctt_3, item_ctt_4
`
### Phân tích ma trận nhiệt giữa các yếu tố

`python
import textwrap

def wrap_labels(ax, width=10):
    ax.set_xticklabels(
        ["\n".join(textwrap.wrap(t.get_text(), width)) for t in ax.get_xticklabels()]
    )
    ax.set_yticklabels(
        ["\n".join(textwrap.wrap(t.get_text(), width)) for t in ax.get_yticklabels()]
    )

def heatmap_pair(df, col1, col2, title, cmap, order1=None, order2=None, ax=None):
    if order1 is not None:
        df[col1] = pd.Categorical(df[col1], categories=order1, ordered=True)
    if order2 is not None:
        df[col2] = pd.Categorical(df[col2], categories=order2, ordered=True)

    ct = pd.crosstab(df[col1], df[col2])

    #plt.figure(figsize=(6, 6))
    ax = sns.heatmap(ct, annot=True, fmt="d", cmap=cmap, cbar=False, ax=ax)

    ax.set_title(title)
    plt.xlabel(col2)
    plt.ylabel(col1)

    ax.set_xticklabels(ax.get_xticklabels(), rotation=0)
    ax.set_yticklabels(ax.get_yticklabels(), rotation=0)
    # Tự động xuống dòng
    wrap_labels(ax, width=8)

    plt.tight_layout()
`

`python
fig, axes = plt.subplots(ncols=3, figsize=(18, 6))
heatmap_pair(item_ctt_1, "Độ khó", "Độ phân biệt",
             "Độ khó vs Độ phân biệt", cmap="Blues",
             order1=order_kho,
             order2=order_pb, ax=axes[0])

heatmap_pair(item_ctt_1, "Độ khó", "Độ nhiễu",
             "Độ khó vs Độ nhiễu", cmap="Greens",
             order1=order_kho,
             order2=order_nhieu, ax=axes[1])

heatmap_pair(item_ctt_1, "Độ phân biệt", "Độ nhiễu",
             "Độ phân biệt vs Độ nhiễu", cmap="Oranges",
             order1=order_pb,
             order2=order_nhieu, ax=axes[2])

plt.suptitle('Ma trận tương quan giữa các chỉ số CTT - Đề 1', fontsize=16, y=1.02)
`

`python
fig, axes = plt.subplots(ncols=3, figsize=(18, 6))
heatmap_pair(item_ctt_2, "Độ khó", "Độ phân biệt",
             "Độ khó vs Độ phân biệt", cmap="Blues",
             order1=order_kho,
             order2=order_pb, ax=axes[0])

heatmap_pair(item_ctt_2, "Độ khó", "Độ nhiễu",
             "Độ khó vs Độ nhiễu", cmap="Greens",
             order1=order_kho,
             order2=order_nhieu, ax=axes[1])

heatmap_pair(item_ctt_2, "Độ phân biệt", "Độ nhiễu",
             "Độ phân biệt vs Độ nhiễu", cmap="Oranges",
             order1=order_pb,
             order2=order_nhieu, ax=axes[2])

plt.suptitle('Ma trận tương quan giữa các chỉ số CTT - Đề 2', fontsize=16, y=1.02)
`

`python
fig, axes = plt.subplots(ncols=3, figsize=(18, 6))
heatmap_pair(item_ctt_3, "Độ khó", "Độ phân biệt",
             "Độ khó vs Độ phân biệt", cmap="Blues",
             order1=order_kho,
             order2=order_pb, ax=axes[0])

heatmap_pair(item_ctt_3, "Độ khó", "Độ nhiễu",
             "Độ khó vs Độ nhiễu", cmap="Greens",
             order1=order_kho,
             order2=order_nhieu, ax=axes[1])

heatmap_pair(item_ctt_3, "Độ phân biệt", "Độ nhiễu",
             "Độ phân biệt vs Độ nhiễu", cmap="Oranges",
             order1=order_pb,
             order2=order_nhieu, ax=axes[2])

plt.suptitle('Ma trận tương quan giữa các chỉ số CTT - Đề 3', fontsize=16, y=1.02)
`

`python
fig, axes = plt.subplots(ncols=3, figsize=(18, 6))
heatmap_pair(item_ctt_4, "Độ khó", "Độ phân biệt",
             "Độ khó vs Độ phân biệt", cmap="Blues",
             order1=order_kho,
             order2=order_pb, ax=axes[0])

heatmap_pair(item_ctt_4, "Độ khó", "Độ nhiễu",
             "Độ khó vs Độ nhiễu", cmap="Greens",
             order1=order_kho,
             order2=order_nhieu, ax=axes[1])

heatmap_pair(item_ctt_4, "Độ phân biệt", "Độ nhiễu",
             "Độ phân biệt vs Độ nhiễu", cmap="Oranges",
             order1=order_pb,
             order2=order_nhieu, ax=axes[2])

plt.suptitle('Ma trận tương quan giữa các chỉ số CTT - Đề 4', fontsize=16, y=1.02)
`
## Phân tích chẩn đoán theo lý thuyết IRT
#### Thực hiện ước lượng tham số a,b

`python
def calc_a_init(
    dfs: list,
    irt,
    min_null: int = 30
):

    import numpy as np
    import pandas as pd

    result = {}

    # =====================================================
    # duyệt từng block
    # =====================================================

    for df in dfs:

        # =================================================
        # lọc thí sinh hợp lệ
        # =================================================

        valid = df[
            df['Null'] < min_null
        ].copy()

        # =================================================
        # std điểm tổng
        # =================================================

        std = valid['Raw'].std()

        # =================================================
        # lấy danh sách câu
        # =================================================

        question_cols = [
            c for c in valid.columns
            if c.startswith('Cau')
        ]

        question_cols = sorted(
            question_cols,
            key=lambda x: int(x.replace('Cau', ''))
        )

        # =================================================
        # tính discrimination
        # =================================================

        for cau_col in question_cols:

            # bỏ câu trống
            item_data = valid[
                valid[cau_col] != -1
            ]

            # không đủ dữ liệu
            if (
                item_data.shape[0] == 0
                or std == 0
                or np.isnan(std)
            ):

                result[cau_col] = np.nan
                continue

            # =============================================
            # corrected total score
            # =============================================

            corrected_total = (
                item_data['Raw']
                - item_data[cau_col]
            )

            # nhóm đúng
            true_group = corrected_total[
                item_data[cau_col] == 1
            ]

            # nhóm sai
            false_group = corrected_total[
                item_data[cau_col] == 0
            ]

            # thiếu dữ liệu
            if (
                true_group.shape[0] == 0
                or false_group.shape[0] == 0
            ):

                result[cau_col] = np.nan
                continue

            # =============================================
            # tỷ lệ đúng
            # =============================================

            p = (
                true_group.shape[0]
                / item_data.shape[0]
            )

            # =============================================
            # PBCC
            # =============================================

            pbcc = ctt.cal_pbcc(
                true_group,
                false_group,
                std,
                p
            )

            # =============================================
            # discrimination
            # =============================================

            try:
                a = ctt.cal_disc(pbcc)
            except:
                a = np.nan

            result[cau_col] = a

    # =====================================================
    # convert thành DataFrame
    # =====================================================

    df_result = pd.DataFrame.from_dict(
        result,
        orient='index',
        columns=['Ans']
    )

    df_result.index.name = 'Cau'

    # sort index
    df_result = df_result.sort_index(
        key=lambda x: x.str.replace('Cau', '').astype(int)
    )

    return df_result
`

`python
a_init_1 = nhieu_1['Ans'].apply(irt.cal_disc)
a_init_2 = nhieu_2['Ans'].apply(irt.cal_disc)
a_init_3 = nhieu_3['Ans'].apply(irt.cal_disc)
a_init_4  = calc_a_init(
    [df_TV4, df_TA4, df_TO4, df_KH4],
    irt)
b_init_1 = diff_1['CTT'].apply(irt.cal_diff)
b_init_2 = diff_2['CTT'].apply(irt.cal_diff)
b_init_3 = diff_3['CTT'].apply(irt.cal_diff)
b_init_4 = diff_4['CTT'].apply(irt.cal_diff)
`

`python
def run_irt_series(series_list):
    a_est_all, b_est_all = [], []

    for df_original, end_idx, name in series_list:

        df = df_original.copy()
        valid_mask = (df["Raw"] > 0) & (df["Raw"] < 30)

        # Chỉ lấy dữ liệu hợp lệ để chạy IRT (bỏ qua các trường hợp đúng/sai hết)
        df_valid = df[valid_mask]
        U = df_valid.drop(columns=['SBD', 'MaDe', 'Gioi', 'Raw', 'Null']).to_numpy()

        # a_init = a_init_all.iloc[end_idx-30:end_idx]
        # b_init = b_init_all.iloc[end_idx-30:end_idx]

        # MMLE
        a_est, b_est = irt.mmle(U=U, name=name, max_iter=200)

        # Tính theta cho dữ liệu hợp lệ
        item_params = list(zip(a_est, b_est))
        theta_valid = irt.theta_estimate(U, item_params=item_params)

        # Tạo mảng theta cuối cùng cho toàn bộ học sinh
        theta = np.empty(len(df))

        # Gán theta tính bằng IRT cho nhóm hợp lệ
        theta[valid_mask.to_numpy()] = theta_valid

        # các trường hợp đúng hoặc sai hết
        theta[df["Raw"] == 0] = -6
        theta[df["Raw"] == 30] = 6

        # Gán theta vào DataFrame
        df_original["Theta"] = theta

        a_est_all.extend(a_est)
        b_est_all.extend(b_est)

    return a_est_all, b_est_all


# --- Chạy cho bộ đề 1 ---
series_1 = [[df_TV1, 30, 'TV'], [df_TA1, 60, 'TA'], [df_TO1, 90, 'TO'], [df_KH1, 120, 'KH']]
a_est_1, b_est_1 = run_irt_series(series_1)

# --- Chạy cho bộ đề 2 ---
series_2 = [[df_TV2, 30, 'TV'], [df_TA2, 60, 'TA'], [df_TO2, 90, 'TO'], [df_KH2, 120, 'KH']]
a_est_2, b_est_2 = run_irt_series(series_2)

# --- Chạy cho bộ đề 3 ---
series_3 = [[df_TV3, 30, 'TV'], [df_TA3, 60, 'TA'], [df_TO3, 90, 'TO'], [df_KH3, 120, 'KH']]
a_est_3, b_est_3 = run_irt_series(series_3)

`

`python
# --- Chạy cho bộ đề 4 ---
series_4 = [[df_TV4, 30, 'TV'], [df_TA4, 60, 'TA'], [df_TO4, 90, 'TO'], [df_KH4, 120, 'KH']]
a_est_4, b_est_4 = run_irt_series(series_4)
`

`python
item_irt_1 = pd.DataFrame({
    'a': a_est_1,
    'b': b_est_1}, index=nhieu_1.index)
item_irt_2 = pd.DataFrame({
    'a': a_est_2,
    'b': b_est_2}, index=nhieu_1.index)
item_irt_3 = pd.DataFrame({
    'a': a_est_3,
    'b': b_est_3}, index=nhieu_1.index)
item_irt_4 = pd.DataFrame({
    'a': a_est_4,
    'b': b_est_4}, index=nhieu_1.index)
`

`python
item_irt_1, item_irt_2, item_irt_3, item_irt_4
`
#### Tính toán điểm thực ở mỗi đề

`python
def cal_true_score(series_list, item_irt):
    cau_cols = series_list.columns[series_list.columns.str.contains("^Cau", regex=True)]

    series_list["True"] = series_list.apply(
        lambda row: irt.true_score(
            theta=row["Theta"],
            raw=row['Raw'],
            data=row[cau_cols],
            item_params=item_irt.loc[cau_cols]  # lấy đúng parameters theo câu
        ),
        axis=1
    )
`

`python
for df_list in [df_TV1, df_TA1, df_TO1, df_KH1]:
    cal_true_score(df_list, item_irt_1)

`

`python
for df_list in [df_TV2, df_TA2, df_TO2, df_KH2]:
    cal_true_score(df_list, item_irt_2)


`

`python
for df_list in [df_TV3, df_TA3, df_TO3, df_KH3]:
    cal_true_score(df_list, item_irt_3)
`

`python
for df_list in [df_TV4, df_TA4, df_TO4, df_KH4]:
    cal_true_score(df_list, item_irt_4)
`

`python
df_true_1 = df_TV1[['SBD', 'True']].copy().rename({'True': 'TrueTV'}, axis=1)

df_true_1 = df_true_1.merge(df_TA1[['SBD', 'True']].rename({'True': 'TrueTA'}, axis=1), on='SBD', how='outer')
df_true_1 = df_true_1.merge(df_TO1[['SBD', 'True']].rename({'True': 'TrueTO'}, axis=1), on='SBD', how='outer')
df_true_1 = df_true_1.merge(df_KH1[['SBD', 'True']].rename({'True': 'TrueKH'}, axis=1), on='SBD', how='outer')
ip.draw_plot(df_true_1, col_name='True', title='Phổ điểm thực - Đề 1', range=(1,300))
`

`python
df_true_2 = df_TV2[['SBD', 'True']].copy().rename({'True': 'TrueTV'}, axis=1)

df_true_2 = df_true_2.merge(df_TA2[['SBD', 'True']].rename({'True': 'TrueTA'}, axis=1), on='SBD', how='outer')
df_true_2 = df_true_2.merge(df_TO2[['SBD', 'True']].rename({'True': 'TrueTO'}, axis=1), on='SBD', how='outer')
df_true_2 = df_true_2.merge(df_KH2[['SBD', 'True']].rename({'True': 'TrueKH'}, axis=1), on='SBD', how='outer')
ip.draw_plot(df_true_2, col_name='True', title='Phổ điểm thực - Đề 2', range=(1,300))
`

`python
df_true_3 = df_TV3[['SBD', 'True']].copy().rename({'True': 'TrueTV'}, axis=1)

df_true_3 = df_true_3.merge(df_TA3[['SBD', 'True']].rename({'True': 'TrueTA'}, axis=1), on='SBD', how='outer')
df_true_3 = df_true_3.merge(df_TO3[['SBD', 'True']].rename({'True': 'TrueTO'}, axis=1), on='SBD', how='outer')
df_true_3 = df_true_3.merge(df_KH3[['SBD', 'True']].rename({'True': 'TrueKH'}, axis=1), on='SBD', how='outer')
ip.draw_plot(df_true_3, col_name='True', title='Phổ điểm thực - Đề 3', range=(1,300))
`

`python
df_true_4 = df_TV4[['SBD', 'True']].copy().rename({'True': 'TrueTV'}, axis=1)

df_true_4 = df_true_4.merge(df_TA4[['SBD', 'True']].rename({'True': 'TrueTA'}, axis=1), on='SBD', how='outer')
df_true_4 = df_true_4.merge(df_TO4[['SBD', 'True']].rename({'True': 'TrueTO'}, axis=1), on='SBD', how='outer')
df_true_4 = df_true_4.merge(df_KH4[['SBD', 'True']].rename({'True': 'TrueKH'}, axis=1), on='SBD', how='outer')
ip.draw_plot(df_true_4, col_name='True', title='Phổ điểm thực - Đề 4', range=(1,300))
`

`python
fig, axes = plt.subplots(2, 2, figsize=(16, 8))
axes = axes.flatten()

def plot_kde_thuc(ax, de_1, de_2, de_3, de_4, title, color):
        sns.kdeplot(
            x=de_1,
            color=color, fill=False, alpha=0.7, label="Đề 1", ax=ax
        )
        sns.kdeplot(
            x=de_2,
            color=color, fill=False, alpha=1.0, linestyle="--", label="Đề 2", ax=ax
        )
        sns.kdeplot(
            x=de_3,
            color=color, fill=False, alpha=1.0, linestyle=":", label="Đề 3", ax=ax
        )
        sns.kdeplot(
            x=de_4,
            color=color, fill=False, alpha=1.0, linestyle="-.", label="Đề 4", ax=ax
        )
        ax.set_xlabel('Số câu đúng')
        ax.set_xlim(1, 300)
        ax.set_ylabel("Mật độ")
        ax.set_title(f"{title}")
        ax.legend()

plot_kde_thuc(axes[0], df_true_1['TrueTV'], df_true_2['TrueTV'], df_true_3['TrueTV'], df_true_4['TrueTV'], "Tiếng Việt", color='b')
plot_kde_thuc(axes[1], df_true_1['TrueTA'], df_true_2['TrueTA'], df_true_3['TrueTA'], df_true_4['TrueTA'], "Tiếng Anh", color='r')
plot_kde_thuc(axes[2], df_true_1['TrueTO'], df_true_2['TrueTO'], df_true_3['TrueTO'], df_true_4['TrueTO'], "Toán", color='y')
plot_kde_thuc(axes[3], df_true_1['TrueKH'], df_true_2['TrueKH'], df_true_3['TrueKH'], df_true_4['TrueKH'], "Tư duy khoa học", color='g')

plt.suptitle('Phổ điểm thô theo từng phần thi', y=0.98)
plt.tight_layout()
plt.show()

`

`python
cols = ['TrueTV', 'TrueTA', 'TrueTO', 'TrueKH']

desc = {}
for c in cols:
    desc[c] = df_true_1.loc[df_true_1[c] != 0, c].describe()

pd.DataFrame(desc)
`

`python
desc = {}
for c in cols:
    desc[c] = df_true_2.loc[df_true_2[c] != 0, c].describe()

pd.DataFrame(desc)
`

`python
desc = {}
for c in cols:
    desc[c] = df_true_3.loc[df_true_3[c] != 0, c].describe()

pd.DataFrame(desc)
`

`python
desc = {}
for c in cols:
    desc[c] = df_true_4.loc[df_true_4[c] != 0, c].describe()

pd.DataFrame(desc)
`

`python
df_true_1['Total_True'] = df_true_1[['TrueTV', 'TrueTA', 'TrueTO', 'TrueKH']].sum(axis=1)
df_true_2['Total_True'] = df_true_2[['TrueTV', 'TrueTA', 'TrueTO', 'TrueKH']].sum(axis=1)
df_true_3['Total_True'] = df_true_3[['TrueTV', 'TrueTA', 'TrueTO', 'TrueKH']].sum(axis=1)
df_true_4['Total_True'] = df_true_4[['TrueTV', 'TrueTA', 'TrueTO', 'TrueKH']].sum(axis=1)
`

`python
def plot_total_with_stats(df_true, title, color):
    total = df_true.shape[0]
    max = df_true['Total_True'].max()
    min = df_true['Total_True'].min()
    mean = df_true['Total_True'].mean()
    std = df_true['Total_True'].std()
    median = df_true['Total_True'].median()

    ip.plot_total(
        df_true['Total_True'],
        title=title,
        range=(1,1200),
        color=color,
        xlabel='Điểm thực',
        ylabel='Số lượng',
        lim=(0, 1200)
    )
    stats_text = f"Tổng số thí sinh dự thi: {total}\nCao nhất: {max}\nThấp nhất: {min:.0f}\nTrung bình: {np.round(mean,2)}\nTrung vị: {np.round(median,2)}\nĐộ lệch chuẩn: {np.round(std,2)}"
    # Thêm một mục "giả" vào legend để hiển thị chú thích kết quả thống kê
    plt.plot([], ' ', label=stats_text)
    plt.legend(loc='upper left', fontsize=12)

`

`python
plot_total_with_stats(df_true_1, title='Phổ điểm theo điểm thực - Đề 1', color='darkblue')
plot_total_with_stats(df_true_2, title='Phổ điểm theo điểm thực - Đề 2', color='purple')
plot_total_with_stats(df_true_3, title='Phổ điểm theo điểm thực - Đề 3', color='grey')
plot_total_with_stats(df_true_4, title='Phổ điểm theo điểm thực - Đề 4', color='brown')
`

`python
plt.figure(figsize=(12, 6))
sns.kdeplot(x=df_true_1['Total_True'],color='darkblue', fill=False, alpha=0.7, label="Đề 1")
sns.kdeplot(x=df_true_2['Total_True'],color='purple', fill=False, alpha=1.0, linestyle="--", label="Đề 2")
sns.kdeplot(x=df_true_3['Total_True'],color='gray', fill=False, alpha=1.0, linestyle=":", label="Đề 3")
sns.kdeplot(x=df_true_4['Total_True'],color='brown', fill=False, alpha=1.0, linestyle="-.", label="Đề 4")
plt.xlabel('Số câu đúng')
plt.ylabel("Mật độ")
plt.title("Phổ điểm thực theo từng đề thi")
plt.xlim(0,1200)
plt.legend()
plt.show()
`

`python
true_total_1 = df_true_1[['SBD', 'Total_True']].merge(df_dot1[['SBD', 'Gioi', 'Email']], left_on='SBD', right_on='SBD')
true_total_2 = df_true_2[['SBD', 'Total_True']].merge(df_dot2[['SBD', 'Gioi', 'Email']], left_on='SBD', right_on='SBD')
true_total_3 = df_true_3[['SBD', 'Total_True']].merge(df_dot3[['SBD', 'Gioi', 'Email']], left_on='SBD', right_on='SBD')
true_total_4 = df_true_4[['SBD', 'Total_True']].merge(df_dot4[['SBD', 'Gioi', 'Email']], left_on='SBD', right_on='SBD')
`

`python
true_total_4 = df_true_4.merge(df_dot4[['SBD', 'Gioi', 'Email']], left_on='SBD', right_on='SBD')
`

`python
true_total_4.to_excel('kq_dot4.xlsx', index=False)
`

`python
fig, axes = plt.subplots(2, 2, figsize=(16, 10))
axes = axes.flatten()

# =========================
# HÀM KDE CHUNG
# =========================
def draw_score_kde(ax, true_total, raw_total, title):
    sns.kdeplot(
        data=true_total,
        x='Total_True',
        ax=ax,
        label='Điểm thực'
    )

    sns.kdeplot(
        raw_total * 10,
        linestyle='--',
        ax=ax,
        label='Điểm thô'
    )

    ax.set_xlim(1, 1200)
    ax.set_title(title)
    ax.set_xlabel('Điểm')
    ax.set_ylabel('Mật độ')
    ax.legend()


# =========================
# ĐỀ 1
# =========================
draw_score_kde(
    axes[0],
    true_total_1,
    rawtotal_1,
    'Đề 1'
)

# =========================
# ĐỀ 2
# =========================
draw_score_kde(
    axes[1],
    true_total_2,
    rawtotal_2,
    'Đề 2'
)

# =========================
# ĐỀ 3
# =========================
draw_score_kde(
    axes[2],
    true_total_3,
    rawtotal_3,
    'Đề 3'
)

# =========================
# ĐỀ 4
# =========================
draw_score_kde(
    axes[3],
    true_total_4,
    rawtotal_4,
    'Đề 4'
)

plt.suptitle(
    'So sánh giữa điểm thô và điểm thực',
    y=0.98
)

plt.tight_layout()
plt.show()
`

`python
fig, axes = plt.subplots(2, 2, figsize=(16, 10))
axes = axes.flatten()

# =========================
# HÀM KDE THEO GIỚI TÍNH
# =========================
def draw_gender_kde(ax, data, title):
    sns.kdeplot(
        data=data,
        x='Total_True',
        hue='Gioi',
        hue_order=['Nam', 'Nữ'],
        ax=ax
    )

    ax.set_xlim(1, 1200)
    ax.set_title(title)
    ax.set_xlabel('Điểm')
    ax.set_ylabel('Mật độ')


# =========================
# ĐỀ 1
# =========================
draw_gender_kde(
    axes[0],
    true_total_1,
    'Đề 1'
)

# =========================
# ĐỀ 2
# =========================
draw_gender_kde(
    axes[1],
    true_total_2,
    'Đề 2'
)

# =========================
# ĐỀ 3
# =========================
draw_gender_kde(
    axes[2],
    true_total_3,
    'Đề 3'
)

# =========================
# ĐỀ 4
# =========================
draw_gender_kde(
    axes[3],
    true_total_4,
    'Đề 4'
)

plt.suptitle(
    'Phổ điểm theo giới tính',
    y=0.98
)

plt.tight_layout()
plt.show()
`
#### Các phân tích sau khi ước lượng tham số
Mô hình hoá câu hỏi theo giá trị trên hệ trục

`python
ip.oxy_item(item_irt_1, title='Mô phỏng độ khó và độ phân biệt câu hỏi sau khi ước lượng - Đề 1')
`

`python
ip.oxy_item(item_irt_2, title='Mô phỏng độ khó và độ phân biệt câu hỏi sau khi ước lượng - Đề 2')
`

`python
ip.oxy_item(item_irt_3, title='Mô phỏng độ khó và độ phân biệt câu hỏi sau khi ước lượng - Đề 3')
`

`python
ip.oxy_item(item_irt_4, title='Mô phỏng độ khó và độ phân biệt câu hỏi sau khi ước lượng - Đề 4')
`

`python
item_irt_1['Phần thi'] = (
    item_irt_1.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

item_irt_2['Phần thi'] = (
    item_irt_2.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

item_irt_3['Phần thi'] = (
    item_irt_3.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

item_irt_4['Phần thi'] = (
    item_irt_4.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)
`

`python
ip.draw_box_plot(
    item_irt_1,
    item_irt_2,
    item_irt_3,
    item_irt_4,
    'Phần thi',
    'a',
    'viridis_d',
    'plasma_d',
    'cividis_d',
    'Greens_d',
    'Chênh lệch độ phân biệt ước lượng theo từng phần thi của mỗi đợt'
)

`

`python
ip.draw_box_plot(
    item_irt_1,
    item_irt_2,
    item_irt_3,
    item_irt_4,
    'Phần thi',
    'b',
    'Blues_d',
    'Purples_d',
    'PuBu_d',
    'mako',
    'Chênh lệch độ khó ước lượng theo từng phần thi của mỗi đợt'
)

`
Đường cong đặc tính bài thi (Test Characteristic Curve)

`python
def drawTTC(df_TV, df_TA, df_TO, df_KH, title: str):
    sns.set_theme(style="whitegrid")
    plt.rcParams['font.family'] = 'serif'
    plt.rcParams['font.serif'] = ['Times New Roman']
    fig, axes = plt.subplots(ncols=2, nrows=2, figsize=(16, 9))

    # ------------------------- chỉnh trục -------------------------
    for ax in axes.flat:
        ax.spines['left'].set_position('zero')
        ax.spines['bottom'].set_position('zero')
        ax.spines['right'].set_color('none')
        ax.spines['top'].set_color('none')
        ax.xaxis.set_ticks_position('bottom')
        ax.yaxis.set_ticks_position('left')


    # ---------------------- gọi các subplot ----------------------
    ip.plot_one(axes[0][0], df_TV["Theta"], df_TV["Raw"], "Tiếng Việt", color='b', lim_low=-6, lim_high=6)
    ip.plot_one(axes[0][1], df_TA["Theta"], df_TA["Raw"], "Tiếng Anh", color='r', lim_low=-6, lim_high=6)
    ip.plot_one(axes[1][0], df_TO["Theta"], df_TO["Raw"], "Toán", color='y', lim_low=-6, lim_high=6)
    ip.plot_one(axes[1][1], df_KH["Theta"], df_KH["Raw"], "Tư duy khoa học", color='g', lim_low=-6, lim_high=6)

    plt.suptitle(title, fontsize=14)
    plt.tight_layout()
    plt.show()

`

`python
drawTTC(df_TV1, df_TA1, df_TO1, df_KH1, title="TCC - Đề 1")
drawTTC(df_TV2, df_TA2, df_TO2, df_KH2, title="TCC - Đề 2")
drawTTC(df_TV3, df_TA3, df_TO3, df_KH3, title="TCC - Đề 3")
drawTTC(df_TV4, df_TA4, df_TO4, df_KH4, title="TCC - Đề 4")
`
So sánh độ khó câu hỏi với năng lực từng phần của thí sinh

`python
fig, axes = plt.subplots(2, 2, figsize=(16, 9))
axes = axes.flatten()

def plot_kde_theta_b(ax, theta, diff, title, color):
        sns.kdeplot(
            x=theta,
            color=color, fill=False, alpha=0.7, label="Năng lực (theta)", ax=ax
        )
        sns.kdeplot(
            x=diff,
            color=color, fill=False, alpha=1.0, linestyle="--", label="Độ khó (b)", ax=ax
        )

        ax.set_xlim(-6, 6)
        ax.set_ylabel("Mật độ")
        ax.set_title(f"{title}")
        ax.legend()

plot_kde_theta_b(axes[0], df_TV1["Theta"], item_irt_1.loc['Cau1':'Cau30', 'b'], "Tiếng Việt", color='b')
plot_kde_theta_b(axes[1], df_TA1["Theta"], item_irt_1.loc['Cau31':'Cau60', 'b'], "Tiếng Anh", color='r')
plot_kde_theta_b(axes[2], df_TO1["Theta"], item_irt_1.loc['Cau61':'Cau90', 'b'], "Toán", color='y')
plot_kde_theta_b(axes[3], df_KH1["Theta"], item_irt_1.loc['Cau91':'Cau120', 'b'], "Tư duy khoa học", color='g')

plt.suptitle("Phân bố năng lực và độ khó câu hỏi - Đề 1", fontsize=14)
plt.tight_layout()
plt.show()
`

`python
fig, axes = plt.subplots(2, 2, figsize=(16, 9))
axes = axes.flatten()
plot_kde_theta_b(axes[0], df_TV2["Theta"], item_irt_2.loc['Cau1':'Cau30', 'b'], "Tiếng Việt", color='b')
plot_kde_theta_b(axes[1], df_TA2["Theta"], item_irt_2.loc['Cau31':'Cau60', 'b'], "Tiếng Anh", color='r')
plot_kde_theta_b(axes[2], df_TO2["Theta"], item_irt_2.loc['Cau61':'Cau90', 'b'], "Toán", color='y')
plot_kde_theta_b(axes[3], df_KH2["Theta"], item_irt_2.loc['Cau91':'Cau120', 'b'], "Tư duy khoa học", color='g')

plt.suptitle("Phân bố năng lực và độ khó câu hỏi - Đề 2", fontsize=14)
plt.tight_layout()
plt.show()
`

`python
fig, axes = plt.subplots(2, 2, figsize=(16, 9))
axes = axes.flatten()
plot_kde_theta_b(axes[0], df_TV3["Theta"], item_irt_3.loc['Cau1':'Cau30', 'b'], "Tiếng Việt", color='b')
plot_kde_theta_b(axes[1], df_TA3["Theta"], item_irt_3.loc['Cau31':'Cau60', 'b'], "Tiếng Anh", color='r')
plot_kde_theta_b(axes[2], df_TO3["Theta"], item_irt_3.loc['Cau61':'Cau90', 'b'], "Toán", color='y')
plot_kde_theta_b(axes[3], df_KH3["Theta"], item_irt_3.loc['Cau91':'Cau120', 'b'], "Tư duy khoa học", color='g')

plt.suptitle("Phân bố năng lực và độ khó câu hỏi - Đề 3", fontsize=14)
plt.tight_layout()
plt.show()
`

`python
fig, axes = plt.subplots(2, 2, figsize=(16, 9))
axes = axes.flatten()
plot_kde_theta_b(axes[0], df_TV4["Theta"], item_irt_4.loc['Cau1':'Cau30', 'b'], "Tiếng Việt", color='b')
plot_kde_theta_b(axes[1], df_TA4["Theta"], item_irt_4.loc['Cau31':'Cau60', 'b'], "Tiếng Anh", color='r')
plot_kde_theta_b(axes[2], df_TO4["Theta"], item_irt_4.loc['Cau61':'Cau90', 'b'], "Toán", color='y')
plot_kde_theta_b(axes[3], df_KH4["Theta"], item_irt_4.loc['Cau91':'Cau120', 'b'], "Tư duy khoa học", color='g')

plt.suptitle("Phân bố năng lực và độ khó câu hỏi - Đề 4", fontsize=14)
plt.tight_layout()
plt.show()
`
Misfit và sai số chuẩn của từng tham số trong câu hỏi

`python
chi_square_1, chi_square_2, chi_square_3 = pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

for df_list in [df_TV1, df_TA1, df_TO1, df_KH1]:
    items = [c for c in df_list.columns if c.startswith("Cau")]
    start_item, end_item = items[0], items[-1]
    res = irt.chi_square(df_list[df_list['Null'] < 30], item_irt_1.loc[start_item:end_item]) # loại các trường hợp không thi 1 phần
    res.index = item_irt_1.loc[start_item:end_item].index
    chi_square_1 = pd.concat([chi_square_1, res], axis=0)

for df_list in [df_TV2, df_TA2, df_TO2, df_KH2]:
    items = [c for c in df_list.columns if c.startswith("Cau")]
    start_item, end_item = items[0], items[-1]
    res = irt.chi_square(df_list[df_list['Null'] < 30], item_irt_2.loc[start_item:end_item])
    res.index = item_irt_2.loc[start_item:end_item].index
    chi_square_2 = pd.concat([chi_square_2, res], axis=0)

for df_list in [df_TV3, df_TA3, df_TO3, df_KH3]:
    items = [c for c in df_list.columns if c.startswith("Cau")]
    start_item, end_item = items[0], items[-1]
    res = irt.chi_square(df_list[df_list['Null'] < 30], item_irt_3.loc[start_item:end_item])
    res.index = item_irt_3.loc[start_item:end_item].index
    chi_square_3 = pd.concat([chi_square_3, res], axis=0)

for df_list in [df_TV4, df_TA4, df_TO4, df_KH4]:
    items = [c for c in df_list.columns if c.startswith("Cau")]
    start_item, end_item = items[0], items[-1]
    res = irt.chi_square(df_list[df_list['Null'] < 30], item_irt_4.loc[start_item:end_item])
    res.index = item_irt_4.loc[start_item:end_item].index
    chi_square_4 = pd.concat([chi_square_4, res], axis=0)


item_irt_1 = pd.concat([item_irt_1, chi_square_1], axis=1)
item_irt_2 = pd.concat([item_irt_2, chi_square_2], axis=1)
item_irt_3 = pd.concat([item_irt_3, chi_square_3], axis=1)
item_irt_4 = pd.concat([item_irt_4, chi_square_4], axis=1)
`

`python
num_pvalue_1 = item_irt_1[item_irt_1['p_value']>=0.05].shape[0]
num_pvalue_2 = item_irt_2[item_irt_2['p_value']>=0.05].shape[0]
num_pvalue_3 = item_irt_3[item_irt_3['p_value']>=0.05].shape[0]
num_pvalue_4 = item_irt_4[item_irt_4['p_value']>=0.05].shape[0]

labels = ["Đề 1", "Đề 2", "Đề 3", "Đề 4"]
values = [num_pvalue_1, num_pvalue_2, num_pvalue_3, num_pvalue_4]

plt.bar(labels, values)
plt.xlabel("Đề thi")
plt.ylabel("Số lượng")
plt.title("So sánh số câu fit mô hình (p-value ≥ 0.05) giữa bốn đề")
for i, v in enumerate(values):
    plt.text(i, v + 0.5, str(v), ha='center', fontsize=12)
plt.show()

`

`python
chi_square_1['Phân loại'] = (
    chi_square_1.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

chi_square_2['Phân loại'] = (
    chi_square_2.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

chi_square_3['Phân loại'] = (
    chi_square_3.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)

chi_square_4['Phân loại'] = (
    chi_square_4.index.str.extract(r'(\d+)', expand=False)
            .astype(int)
            .map(lambda x: "Tiếng Việt" if x<=30 else
                           "Tiếng Anh" if x<=60 else
                           "Toán" if x<=90 else
                           "Tư duy khoa học")
)
`

`python
ip.plot_item(chi_square_1[chi_square_1['p_value']>=0.05],
             chi_square_2[chi_square_2['p_value']>=0.05],
                chi_square_3[chi_square_3['p_value']>=0.05],
               chi_square_4[chi_square_4['p_value']>=0.05],
             title='Thống kê số lượng câu hỏi fit mô hình IRT bằng kiểm định Chi-squared', order=['Tiếng Việt', 'Tiếng Anh', 'Toán', 'Tư duy khoa học'], palette='mako_d', size=(8,6))
`

`python
for item_list in ([item_irt_1, item_irt_2, item_irt_3, item_irt_4]):
    ses = irt.all_item_se(item_list[['a', 'b']].to_numpy())
    item_list['a_SE'] = ses[:, 0]
    item_list['b_SE'] = ses[:, 1]
`

`python
sns.scatterplot(data=item_irt_1, x='b_SE', y='a_SE', color='b', label='Đề 1')
sns.scatterplot(data=item_irt_2, x='b_SE', y='a_SE', color='r', label='Đề 2')
sns.scatterplot(data=item_irt_3, x='b_SE', y='a_SE', color='g', label='Đề 3')
sns.scatterplot(data=item_irt_4, x='b_SE', y='a_SE', color='m', label='Đề 4')
plt.xlim(0, 40)
plt.ylim(0, 10)
plt.legend(title='Đề')
plt.title("Sai số chuẩn ước lượng tham số các câu hỏi")
`

`python
sns.histplot(item_irt_1[item_irt_1['p_value'] <0.05]['p_value'], label='Đề 1', bins=5, binrange=(0, 0.05))
sns.histplot(item_irt_2[item_irt_2['p_value'] <0.05]['p_value'], label='Đề 2', bins=5, binrange=(0, 0.05))
sns.histplot(item_irt_3[item_irt_3['p_value'] <0.05]['p_value'], label='Đề 3', bins=5, binrange=(0, 0.05))
sns.histplot(item_irt_4[item_irt_4['p_value'] <0.05]['p_value'], label='Đề 4', bins=5, binrange=(0, 0.05))
plt.legend()
plt.xlim(0, 0.05)
plt.ylabel('Số lượng')
plt.title('Thống kê các câu hỏi không phù hợp với mô hình theo p_value')
`

`python
print('Thống kê ở đề 1:')
print(f'- Các câu hỏi misfit: {list(item_irt_1[item_irt_1['p_value'] <0.05].index)}')
print(f'- Các câu hỏi có a_SE cao: {list(item_irt_1[item_irt_1['a_SE'] > 3.0].index)}')
print(f'- Các câu hỏi có b_SE cao: {list(item_irt_1[item_irt_1['b_SE'] > 10.0].index)}')
print(f"CẦN PHẢI XEM XÉT VÀ CHỈNH SỬA HOẶC LOẠI BỎ: {list(item_irt_1[(item_irt_1['p_value'] < 0.05) &
                                                    ((item_irt_1['b_SE'] > 10.0) | (item_irt_1['a_SE'] > 3.0))
        ].index
    )}"
)


print('\nThống kê ở đề 2:')
print(f'- Các câu hỏi misfit: {list(item_irt_2[item_irt_2['p_value'] <0.05].index)}')
print(f'- Các câu hỏi có a_SE cao: {list(item_irt_2[item_irt_2['a_SE'] > 3.0].index)}')
print(f'- Các câu hỏi có b_SE cao: {list(item_irt_2[item_irt_2['b_SE'] > 10.0].index)}')
print(f"CẦN PHẢI XEM XÉT VÀ CHỈNH SỬA HOẶC LOẠI BỎ: {list(item_irt_2[(item_irt_2['p_value'] < 0.05) &
                                                    ((item_irt_2['b_SE'] > 10.0) | (item_irt_2['a_SE'] > 3.0))
        ].index
    )}"
)

print('\nThống kê ở đề 3:')
print(f'- Các câu hỏi misfit: {list(item_irt_3[item_irt_3['p_value'] <0.05].index)}')
print(f'- Các câu hỏi có a_SE cao: {list(item_irt_3[item_irt_3['a_SE'] > 3.0].index)}')
print(f'- Các câu hỏi có b_SE cao: {list(item_irt_3[item_irt_3['b_SE'] > 10.0].index)}')
print(f"CẦN PHẢI XEM XÉT VÀ CHỈNH SỬA HOẶC LOẠI BỎ: {list(item_irt_3[(item_irt_3['p_value'] < 0.05) &
                                                    ((item_irt_3['b_SE'] > 10.0) | (item_irt_3['a_SE'] > 3.0))
        ].index
    )}"
)

print('\nThống kê ở đề 4:')
print(f'- Các câu hỏi misfit: {list(item_irt_4[item_irt_4['p_value'] <0.05].index)}')
print(f'- Các câu hỏi có a_SE cao: {list(item_irt_4[item_irt_4['a_SE'] > 3.0].index)}')
print(f'- Các câu hỏi có b_SE cao: {list(item_irt_4[item_irt_4['b_SE'] > 10.0].index)}')
print(f"CẦN PHẢI XEM XÉT VÀ CHỈNH SỬA HOẶC LOẠI BỎ: {list(item_irt_4[(item_irt_4['p_value'] < 0.05) &
                                                    ((item_irt_4['b_SE'] > 10.0) | (item_irt_4['a_SE'] > 3.0))
        ].index
    )}"
)
`
Sai số chuẩn trong ước lượng năng lực thí sinh

`python
def plot_theta_se(df_list, item_irt):
    items = [c for c in df_list.columns if c.startswith("Cau")]

    response = df_list[items].replace(-1, 0)

    se = irt.all_ability_se(
        response.to_numpy(),
        item_irt.loc[items][['a', 'b']].to_numpy(),
        df_list['Theta'][df_list['Null'] < 30].to_numpy()
    )

    return se


list_names = [
    ["Tiếng Việt", "Tiếng Anh", "Toán", "Tư duy khoa học"],
    ["Tiếng Việt", "Tiếng Anh", "Toán", "Tư duy khoa học"],
    ["Tiếng Việt", "Tiếng Anh", "Toán", "Tư duy khoa học"],
    ["Tiếng Việt", "Tiếng Anh", "Toán", "Tư duy khoa học"]
]

all_df_groups = [
    [df_TV1, df_TA1, df_TO1, df_KH1],
    [df_TV2, df_TA2, df_TO2, df_KH2],
    [df_TV3, df_TA3, df_TO3, df_KH3],
    [df_TV4, df_TA4, df_TO4, df_KH4]
]

all_item_irt = [
    item_irt_1,
    item_irt_2,
    item_irt_3,
    item_irt_4
]

titles = [
    "Đề 1",
    "Đề 2",
    "Đề 3",
    "Đề 4"
]

# =========================
# TẠO SUBPLOT 2x2
# =========================
fig, axes = plt.subplots(2, 2, figsize=(16, 10))
axes = axes.flatten()

for ax, df_group, names, item_irt, title in zip(
    axes,
    all_df_groups,
    list_names,
    all_item_irt,
    titles
):
    for df, name in zip(df_group, names):

        se = plot_theta_se(df, item_irt)

        sns.kdeplot(
            se,
            label=name,
            ax=ax
        )

    ax.set_xlabel("Theta_SE")
    ax.set_ylabel('Mật độ')
    ax.set_title(title)
    ax.legend()

plt.suptitle(
    'Sai số chuẩn ước lượng năng lực thí sinh',
    y=0.98
)

plt.tight_layout()
plt.show()
`

`python
list_names = [
    ["Tiếng Việt", "Tiếng Anh", "Toán", "Tư duy khoa học"],
    ["Tiếng Việt", "Tiếng Anh", "Toán", "Tư duy khoa học"],
    ["Tiếng Việt", "Tiếng Anh", "Toán", "Tư duy khoa học"],
    ["Tiếng Việt", "Tiếng Anh", "Toán", "Tư duy khoa học"]
]

all_df_groups = [
    [df_TV1, df_TA1, df_TO1, df_KH1],
    [df_TV2, df_TA2, df_TO2, df_KH2],
    [df_TV3, df_TA3, df_TO3, df_KH3],
    [df_TV4, df_TA4, df_TO4, df_KH4]
]

all_item_irt = [
    item_irt_1,
    item_irt_2,
    item_irt_3,
    item_irt_4
]

titles = [
    "Đề 1",
    "Đề 2",
    "Đề 3",
    "Đề 4"
]

# =========================
# TẠO SUBPLOT 2x2
# =========================
fig, axes = plt.subplots(2, 2, figsize=(16, 10))
axes = axes.flatten()

for ax, df_group, names, item_irt, title in zip(
    axes,
    all_df_groups,
    list_names,
    all_item_irt,
    titles
):
    for df, name in zip(df_group, names):

        # lọc dữ liệu giống plot_theta_se
        mask = df['Null'] < 30

        theta = df.loc[mask, 'Theta']

        theta_se = plot_theta_se(
            df,
            item_irt
        )

        sns.scatterplot(
            x=theta,
            y=theta_se,
            ax=ax,
            label=name,
            s=25
        )

    ax.set_xlabel("Theta")
    ax.set_ylabel("SE(Theta)")
    ax.set_title(title)

    ax.set_xlim(-6, 6)

    ax.legend(
        title="Môn",
        loc='upper center'
    )

plt.suptitle(
    'Sai số chuẩn ước lượng năng lực thí sinh',
    y=0.98
)

plt.tight_layout()
plt.show()
`
## Phân tích tương quan và phân tích hồi quy
### Tương quan điểm thực của hai đề thi

`python
df_true_1_copy, df_true_2_copy, df_true_3_copy = df_true_1.copy(), df_true_2.copy(), df_true_3.copy()
df_true_1_copy = df_true_1_copy.merge(df_dot1[['SBD', 'Email']], how='left', left_on='SBD', right_on='SBD')
df_true_2_copy = df_true_2_copy.merge(df_dot2[['SBD', 'Email']], how='left', left_on='SBD', right_on='SBD')
df_true_3_copy = df_true_3_copy.merge(df_dot3[['SBD', 'Email']], how='left', left_on='SBD', right_on='SBD')

df_true_1_copy = df_true_1_copy.merge(df_survey, how='right', left_on='Email', right_on='Mail').dropna().drop(columns=['Mail', 'SBD']).set_index('Email')
df_true_2_copy = df_true_2_copy.merge(df_survey, how='right', left_on='Email', right_on='Mail').dropna().drop(columns=['Mail', 'SBD']).set_index('Email')
df_true_3_copy = df_true_3_copy.merge(df_survey, how='right', left_on='Email', right_on='Mail').dropna().drop(columns=['Mail', 'SBD']).set_index('Email')
`

`python
df_true_1 = df_true_1.merge(df_dot1[['SBD', 'Email']], how='left', left_on='SBD', right_on='SBD')
df_true_2 = df_true_2.merge(df_dot2[['SBD', 'Email']], how='left', left_on='SBD', right_on='SBD')
df_true_3 = df_true_3.merge(df_dot3[['SBD', 'Email']], how='left', left_on='SBD', right_on='SBD')
`

`python
corr_12 = df_true_1.merge(df_true_2, how='inner', left_on='Email', right_on='Email', suffixes=('_1', '_2'))
corr_12
`

`python
# 1 - 3
corr_13 = df_true_1.merge(
    df_true_3,
    how='inner',
    on='Email',
    suffixes=('_1', '_3')
)

# 2 - 3
corr_23 = df_true_2.merge(
    df_true_3,
    how='inner',
    on='Email',
    suffixes=('_2', '_3')
)

corr_13, corr_23
`

`python
def test_correlation(corr_both, title, x_1, x_2):
    parts = ['TV', 'TA', 'TO', 'KH']
    results = []
    fig, axes = plt.subplots(2, 2, figsize=(16, 8))
    axes = axes.flatten()

    for col in parts:

        # Lọc dữ liệu hợp lệ (phải có điểm thực cả hai đề thi)
        corr_check = corr_both[[f'True{col}_{x_1}', f'True{col}_{x_2}']].where(
            lambda x: (x[f'True{col}_{x_1}'] > 0) & (x[f'True{col}_{x_2}'] > 0)
        ).dropna()

        X = corr_check[[f'True{col}_{x_1}']].values.reshape(-1, 1)
        y = corr_check[f'True{col}_{x_2}'].values

        model = LinearRegression()
        model.fit(X, y)

        y_pred = model.predict(X)
        residuals = y - y_pred

        slope = model.coef_[0]
        intercept = model.intercept_
        r_sq = r2_score(y, y_pred)
        r, _ = pearsonr(corr_check[f'True{col}_{x_1}'], corr_check[f'True{col}_{x_2}'])

        mse = np.mean((y - y_pred)**2)
        rmse = np.sqrt(mse)
        n, p = X.shape
        rse = np.sqrt(np.sum(residuals**2) / (n - p - 1))
        mae = np.mean(np.abs(y - y_pred))
        skewness = skew(residuals)

        results.append([
            col, r_sq, r, mse, rmse, mae, rse,
            skewness,
        ])
        sns.scatterplot(
            data=corr_check,
            x=f'True{col}_{x_1}',
            y=f'True{col}_{x_2}',
            ax=axes[['TV', 'TA', 'TO', 'KH'].index(col)]
        )
        sns.lineplot(
            x=corr_check[f'True{col}_{x_1}'],
            y=y_pred,
            color='red',
            linewidth=2,
            ax=axes[['TV', 'TA', 'TO', 'KH'].index(col)]
        )
        axes[['TV', 'TA', 'TO', 'KH'].index(col)].set_xlim(0, 300)
        axes[['TV', 'TA', 'TO', 'KH'].index(col)].set_ylim(0, 300)

        plt.suptitle(title, y=0.92)

    df_reg = pd.DataFrame(results, columns=[
        'Section', 'R²', 'Pearson_r',
        'MSE', 'RMSE', 'MAE', 'RSE',
        'Skewness'
    ])
    print(f"=== {title} ===")
    print(df_reg.round(4))
`

`python
reg_12 = test_correlation(
    corr_12,
    'Tương quan tuyến tính giữa Đề 1 và Đề 2 theo từng phần thi',
    x_1=1, x_2=2
)

reg_13 = test_correlation(
    corr_13,
    'Tương quan tuyến tính giữa Đề 1 và Đề 3 theo từng phần thi',
    x_1=1, x_2=3
)

reg_23 = test_correlation(
    corr_23,
    'Tương quan tuyến tính giữa Đề 2 và Đề 3 theo từng phần thi',
    x_1=2, x_2=3
)

`
### Tương quan giữa điểm thô và điểm thực

`python
def raw_true_analysis(df_list, title_prefix):
    """
    df_list: list các tuple (label, dataframe)
             dataframe phải có cột 'Raw' và 'True'
    title_prefix: 'Đề 1' hoặc 'Đề 2'
    """

    print(f'\n{title_prefix}')

    color_map = {
        'TV': 'b',
        'TA': 'r',
        'TO': 'y',
        'KH': 'g'
    }

    fig, axes = plt.subplots(2, 2, figsize=(16, 8))
    axes = axes.flatten()

    for i, (label, df) in enumerate(df_list):
        # Lọc dữ liệu hợp lệ
        df_part = df[df['Raw'] > 0].copy()

        x = df_part['Raw'].to_numpy().reshape(-1, 1)
        y = df_part['True'].to_numpy()

        # 1. Tương quan Pearson
        corr, _ = pearsonr(df_part['Raw'], df_part['True'])

        # 2. Hồi quy tuyến tính
        model = LinearRegression()
        model.fit(x, y)

        alpha = model.coef_[0]
        beta = model.intercept_

        # 3. Dự đoán & sai số
        y_pred = model.predict(x)
        mse = mean_squared_error(y, y_pred)
        rmse = np.sqrt(mse)
        r2 = r2_score(y, y_pred)

        print(
            f'{label}: '
            f'True = {alpha:.4f} × Raw + {beta:.4f} | '
            f'r = {corr:.4f} | '
            f'R² = {r2:.4f} | '
            f'MSE = {mse:.2f} | RMSE = {rmse:.2f}'
        )

        # 4. Scatter + đường hồi quy
        ax = axes[i]
        color = color_map.get(label, 'black')

        ax.scatter(
            df_part['True'],
            df_part['Raw'],
            alpha=0.6,
            color=color,
            label='Quan sát'
        )

        x_line = np.linspace(df_part['Raw'].min(), df_part['Raw'].max(), 1000)
        y_line = alpha * x_line + beta
        ax.plot(y_line, x_line, color=color, linewidth=2, label='Đường hồi quy')

        ax.set_xlabel('Điểm thô')
        ax.set_ylabel('Điểm thực')
        ax.set_xlim(1, 300)
        ax.set_ylim(1, 30)
        ax.set_title(f'{label}')

        ax.legend(loc='upper left')

    plt.suptitle(f'{title_prefix}: Raw vs True score', fontsize=16, y=0.92)
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.show()



# ===== CHẠY PHÂN TÍCH =====
print('Tương quan giữa các phần và công thức quy đổi điểm thô sang điểm thực')

# Đề 1
raw_true_analysis(
    df_list=[
        ('TV', df_TV1),
        ('TA', df_TA1),
        ('TO', df_TO1),
        ('KH', df_KH1),
    ],
    title_prefix='Đề 1'
)

# Đề 2
raw_true_analysis(
    df_list=[
        ('TV', df_TV2),
        ('TA', df_TA2),
        ('TO', df_TO2),
        ('KH', df_KH2),
    ],
    title_prefix='Đề 2'
)

# Đề 3
raw_true_analysis(
    df_list=[
        ('TV', df_TV3),
        ('TA', df_TA3),
        ('TO', df_TO3),
        ('KH', df_KH3),
    ],
    title_prefix='Đề 3'
)
`
### Tương quan giữa tham số cổ điển và tham số ước lượng

`python
def correlation_table(classic_list, est_list, titles, sections):
    rows = []

    for (classic, est, title) in zip(classic_list, est_list, titles):
        for start, name in sections:

            x = classic.iloc[start:start+30]
            y = est.iloc[start:start+30]

            # Loại NaN và inf
            mask = np.isfinite(x) & np.isfinite(y)
            x = x[mask]
            y = y[mask]

            # Nếu đủ số quan sát thì tính corr
            if len(x) > 2:
                corr, _ = pearsonr(x, y)
                corr = round(corr, 4)
            else:
                corr = np.nan

            rows.append([title, name, corr])

    df = pd.DataFrame(rows, columns=["Pair", "Section", "Corr"])
    return df.pivot(index="Pair", columns="Section", values="Corr")


sections = [(0, 'TV'), (30, 'TA'), (60, 'TO'), (90, 'KH')]
titles = ["Diff", "Disc", "Pt.Bis"]

classic_list_1 = [1 - diff_1['CTT'], disc_1['D-Index'], nhieu_1['Ans']]
est_list_1     = [item_irt_1['b'], item_irt_1['a'], item_irt_1['a']]

classic_list_2 = [1 - diff_2['CTT'], disc_2['D-Index'], nhieu_2['Ans']]
est_list_2     = [item_irt_2['b'], item_irt_2['a'], item_irt_2['a']]

classic_list_3 = [1 - diff_3['CTT'], disc_3['D-Index'], nhieu_3['Ans']]
est_list_3     = [item_irt_3['b'], item_irt_3['a'], item_irt_3['a']]

table_1 = correlation_table(classic_list_1, est_list_1, titles, sections)
table_2 = correlation_table(classic_list_2, est_list_2, titles, sections)
table_3 = correlation_table(classic_list_3, est_list_3, titles, sections)

print("Tương quan giữa tham số cổ điển và tham số ước lượng\nĐỀ 1")
print(table_1)
print("\nĐỀ 2")
print(table_2)
print("\nĐỀ 3")
print(table_3)

`
### Tương quan giữa kết quả học tập và kết quả thi thử

`python
thi_sinh_set = thisinh_all3 | thisinh_exactly2
thi_sinh = pd.Series(list(thi_sinh_set), name='Mail')

df_survey_copy = df_survey.merge(
    thi_sinh.to_frame(),
    how='right',
    on='Mail'
)

`

`python
df_survey_copy
`
Tính toán tương giữa điểm trung bình từng học kì với điểm thực của mỗi đề (theo từng môn)

`python
def calculate_correlations(df_true):
    correlations = {}
    subjects = ['TV', 'TA', 'TO']
    semesters = ['10_1', '10_2', '11_1', '11_2']

    for subject in subjects:
        score_col = f'True{subject}'
        for sem in semesters:
            subject_col = f'{subject}{sem}'

            x = df_true[score_col]
            y = df_true[subject_col]

            # Loại bỏ NaN
            mask = (~x.isna()) & (~y.isna())
            x_valid = x[mask]
            y_valid = y[mask]

            if len(x_valid) < 2:
                correlations[f'{score_col} vs {subject_col}'] = None
                continue

            corr, _ = pearsonr(x_valid, y_valid)
            correlations[f'{score_col} vs {subject_col}'] = round(corr, 4)

    return correlations


def print_correlations(title, corr_dict):
    print(title)
    for key, value in corr_dict.items():
        print(f'{key}: {value}')
    print()


corr1 = calculate_correlations(df_true_1_copy)
corr2 = calculate_correlations(df_true_2_copy)
corr3 = calculate_correlations(df_true_3_copy)

print_correlations("Hệ số tương quan đề 1:", corr1)
print_correlations("Hệ số tương quan đề 2:", corr2)
print_correlations("Hệ số tương quan đề 3:", corr3)
`
