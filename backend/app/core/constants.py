# ─── Mastery status thresholds ───────────────────────────────────────────
# Đặt ở 1 nơi duy nhất — thay đổi 1 dòng nếu cần recalibrate sau khi
# có cohort data thật (hiện tại là educated guess).

# Tỉ lệ đúng >= này → on_track (đang theo kịp)
MASTERY_ON_TRACK_THRESHOLD = 0.75

# Tỉ lệ đúng >= này nhưng < ON_TRACK → upcoming_review (ôn tiếp theo)
MASTERY_UPCOMING_THRESHOLD = 0.50

# Tỉ lệ đúng < UPCOMING → overdue_review (cần ôn ngay)
# (implicit: anything below UPCOMING)

# Nếu lần sai cuối > số ngày này mà chưa có đúng mới → overdue bất kể %
MASTERY_OVERDUE_DAYS = 7

# Heatmap intensity bins (submissions_count + lessons_watched_count)
HEATMAP_LEVEL_LOW = 1       # 1 hoạt động = "Ít hoạt động"
HEATMAP_LEVEL_MEDIUM = 3    # 2-3 = "Hoạt động"
HEATMAP_LEVEL_HIGH = 5      # 4-5 = "Tích cực"
# >= HIGH = "Nổi bật"

# Số phần thi (phân môn)
SUBJECT_PARTS = {
    1: "tieng_viet",
    2: "tieng_anh",
    3: "toan_hoc",
    4: "tu_duy_khoa_hoc",
}

SUBJECT_LABELS = {
    "tieng_viet": "Tiếng Việt",
    "tieng_anh": "Tiếng Anh",
    "toan_hoc": "Toán học",
    "tu_duy_khoa_hoc": "Tư duy khoa học",
}
