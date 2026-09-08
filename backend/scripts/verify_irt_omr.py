"""
Script kiểm chứng (verification) cho 2 lõi chấm điểm của hệ thống:
  1. IRT 2PL — MMLE (irt_engine.py): phục hồi tham số a/b, ước lượng theta,
     kiểm định chi-square, SE của item & theta, quy đổi true_score.
  2. CTT — độ khó/độ phân biệt (ctt_engine.py).
  3. OMR — pipeline OpenCV (opencv_layer.py + hybrid_omr.py): sinh phiếu trả lời
     tổng hợp (synthetic sheet) đúng theo SheetLayout, tô SBD/Mã đề/120 câu,
     sau đó đọc lại và đối chiếu kết quả.

Cách chạy (từ thư mục backend):
    .venv\\Scripts\\python.exe scripts\\verify_irt_omr.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import pandas as pd
import cv2

from app.services.grading.irt_engine import (
    mmle,
    theta_estimate,
    chi_square,
    item_se,
    all_ability_se,
    true_score,
)
from app.services.grading.ctt_engine import cal_diff, cal_disc, cal_pbcc
from app.services.omr.layout_config import SheetLayout
from app.services.omr.layers.opencv_layer import OpenCVOMRPipeline
from app.services.omr.hybrid_omr import HybridOMREngine

SEED = 42
results_log = []


def check(name: str, cond: bool, detail: str = "") -> None:
    status = "PASS" if cond else "FAIL"
    results_log.append((name, status, detail))
    print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))


def section(title: str) -> None:
    print(f"\n{'=' * 64}\n{title}\n{'=' * 64}")


# ══════════════════════════════════════════════════════════════════════════
# 1. IRT 2PL — MMLE
# ══════════════════════════════════════════════════════════════════════════
def verify_irt() -> None:
    section("1. KIỂM CHỨNG IRT 2PL (MMLE + theta + chi-square + SE + true_score)")
    rng = np.random.default_rng(SEED)
    N, J = 600, 20  # N >= 200: đủ điều kiện MMLE theo nghiệp vụ
    true_a = rng.uniform(0.7, 1.8, J)
    true_b = np.sort(rng.uniform(-1.5, 1.5, J))
    true_theta = rng.normal(0.0, 1.0, N)

    P = 1.0 / (1.0 + np.exp(-1.702 * true_a[None, :] * (true_theta[:, None] - true_b[None, :])))
    U = (rng.random((N, J)) < P).astype(float)

    # 1.1 MMLE phục hồi tham số item
    a_est, b_est = mmle(U, name="VERIFY", max_iter=60, verbose=False)
    corr_b = float(np.corrcoef(true_b, b_est)[0, 1])
    mae_b = float(np.mean(np.abs(true_b - b_est)))
    check("MMLE phục hồi độ khó b (corr > 0.85)", corr_b > 0.85, f"corr={corr_b:.3f}, MAE={mae_b:.3f}")
    check("MMLE tham số a trong khoảng hợp lý", bool(np.all((a_est > 0.05) & (a_est < 3.0))),
          f"a range=[{a_est.min():.2f}, {a_est.max():.2f}]")

    # 1.2 Ước lượng theta
    item_params = list(zip(a_est, b_est))
    theta_idx = np.arange(0, N, 10)  # lấy 60 thí sinh đại diện cho nhanh
    theta_est = np.array(theta_estimate(U[theta_idx], [item_params[j] for j in range(J)]))
    corr_theta = float(np.corrcoef(true_theta[theta_idx], theta_est)[0, 1])
    check("Theta estimate khớp năng lực thật (corr > 0.85)", corr_theta > 0.85, f"corr={corr_theta:.3f}")

    # 1.3 Kiểm định chi-square (df cần cột "Theta" + các cột item trùng index item_param)
    cols = [f"Cau{j + 1}" for j in range(J)]
    df_chi = pd.DataFrame(U, columns=cols)
    df_chi["Theta"] = theta_estimate(U, item_params)
    item_param_df = pd.DataFrame({"a": a_est, "b": b_est}, index=cols)
    chi_df = chi_square(df_chi, item_param_df)
    check("chi_square trả kết quả đủ J item", len(chi_df) == J, f"rows={len(chi_df)}")
    check("chi_square không có item bị bỏ (không NaN)",
          bool(chi_df["p_value"].notna().all()), f"p_value mean={chi_df['p_value'].mean():.3f}")
    fit_ratio = float((chi_df["p_value"] > 0.05).mean())
    check("chi-square: đa số item fit với mô hình 2PL (> 60%)", fit_ratio > 0.6,
          f"{fit_ratio * 100:.0f}% item có p > 0.05 (dữ liệu sinh đúng 2PL)")

    # 1.4 SE của item & ability
    se_a, se_b = item_se(a_est[0], b_est[0])
    check("item_se trả SE hữu hạn, dương", np.isfinite(se_a) and se_a > 0 and np.isfinite(se_b) and se_b > 0,
          f"se_a={se_a:.3f}, se_b={se_b:.3f}")
    ses = all_ability_se(U[theta_idx][:5], item_params, theta_est[:5])
    check("ability_se trả SE hữu hạn, dương", bool(np.all(np.isfinite(ses)) and np.all(ses > 0)),
          f"SE range=[{ses.min():.3f}, {ses.max():.3f}]")

    # 1.5 true_score: quy đổi 0-300
    one = pd.Series(U[0], index=cols)
    raw = int(one.sum())
    ts = true_score(theta_est[0], raw, one, item_param_df)
    check("true_score trả điểm trong [0, 300]", 0 <= ts <= 300, f"raw={raw}/20 → irt_scaled={ts}")


# ══════════════════════════════════════════════════════════════════════════
# 2. CTT
# ══════════════════════════════════════════════════════════════════════════
def verify_ctt(U: np.ndarray) -> None:
    section("2. KIỂM CHỨNG CTT (độ khó p, độ phân biệt D-index, point-biserial)")
    N, J = U.shape
    cols = [f"Cau{j + 1}" for j in range(J)]
    df = pd.DataFrame(U, columns=cols)
    df.insert(0, "Raw", U.sum(axis=1))
    df.insert(0, "Gioi", 0)
    df.insert(0, "MaDe", 161)
    df.insert(0, "Null", 0)
    df.insert(0, "SBD", np.arange(1, N + 1))

    p_vals = cal_diff(df)
    check("cal_diff (độ khó p) trong (0, 1]", bool(((p_vals > 0) & (p_vals <= 1)).all()),
          f"p range=[{p_vals.min():.2f}, {p_vals.max():.2f}]")
    true_p = U.mean(axis=0)
    err_p = float(np.abs(p_vals.values - true_p).max())
    check("cal_diff khớp tỷ lệ đúng thực tế", err_p < 1e-9, f"max_err={err_p:.2e}")

    d_vals = cal_disc(df)
    check("cal_disc (D-index) trong [-1, 1]", bool(((d_vals >= -1) & (d_vals <= 1)).all()),
          f"D range=[{d_vals.min():.2f}, {d_vals.max():.2f}]")
    check("cal_disc: item có độ phân biệt thật cao → D > 0",
          bool((d_vals.values > 0).mean() > 0.8), f"{(d_vals.values > 0).mean() * 100:.0f}% item D > 0")

    item_j = 0
    high = df.sort_values("Raw", ascending=False).head(50)[cols[item_j]].mean()
    low = df.sort_values("Raw", ascending=False).tail(50)[cols[item_j]].mean()
    std = df[cols[item_j]].std()
    idv = df[cols[item_j]].mean()
    r = cal_pbcc(pd.Series([high] * 10), pd.Series([low] * 10), std, idv)
    check("cal_pbcc (point-biserial) trả giá trị hợp lệ", np.isfinite(r) and -1 <= r <= 1, f"r={r:.3f}")


# ══════════════════════════════════════════════════════════════════════════
# 3. OMR — sinh phiếu tổng hợp theo SheetLayout rồi đọc lại
# ══════════════════════════════════════════════════════════════════════════
SBD_TRUTH = "123456"
MA_DE_TRUTH = "161"
BLANK_QUESTIONS = {5, 46, 110}        # bỏ trống → selected = None
MULTI_MARK_QUESTIONS = {12, 77}       # tô 2 ô → needs_review


def audit_layout_geometry(layout: SheetLayout) -> list:
    """Kiểm tra mọi bubble nằm trong khung 0-100% (tránh bug tràn khung như cell_w/cell_h cũ)."""
    issues = []

    def audit_bubble(where, b):
        if not (0 <= b.cx - b.radius and b.cx + b.radius <= 100):
            issues.append(f"{where}: cx={b.cx:.2f}% r={b.radius:.2f}% tràn ngang")
        if not (0 <= b.cy - b.radius and b.cy + b.radius <= 100):
            issues.append(f"{where}: cy={b.cy:.2f}% r={b.radius:.2f}% tràn dọc")

    for ci, col in enumerate(layout.get_sbd_bubbles()):
        for ri, b in enumerate(col):
            audit_bubble(f"SBD c{ci} r{ri}", b)
    for ci, col in enumerate(layout.get_ma_de_bubbles()):
        for ri, b in enumerate(col):
            audit_bubble(f"MaDe c{ci} r{ri}", b)
    for i, b in enumerate(layout.get_type_bubbles()):
        audit_bubble(f"Type {i}", b)
    for q, bubbles in layout.get_all_question_bubbles().items():
        for li, b in enumerate(bubbles):
            audit_bubble(f"Q{q}{'ABCD'[li]}", b)
    return issues


def generate_synthetic_sheet(layout: SheetLayout, perspective_noise: float = 0.0) -> np.ndarray:
    """
    Vẽ phiếu trả lời tổng hợp đúng theo layout (% → pixel), tô đáp án mẫu.

    Lưu ý quan trọng (đúng nghiệp vụ phiếu OMR thật): toàn bộ nội dung bubble
    được vẽ NÉN vào vùng giữa 4 marker góc (marker centre ≡ góc khung chuẩn),
    vì pipeline sẽ warp 4 marker tâm → 4 góc ảnh. Nếu vẽ content theo % thô trên
    toàn canvas, sau warp bubble sẽ lệch ~5% và đọc sai.
    """
    W, H = layout.target_width, layout.target_height
    img = np.full((H, W, 3), 255, dtype=np.uint8)

    tl = (layout.markers[0].cx / 100 * W, layout.markers[0].cy / 100 * H)
    tr = (layout.markers[1].cx / 100 * W, layout.markers[1].cy / 100 * H)
    bl = (layout.markers[3].cx / 100 * W, layout.markers[3].cy / 100 * H)

    def px(cx_pct: float, cy_pct: float):
        """Map % chuẩn (khung sau warp) → toạ độ pixel trên ảnh gốc (giữa 4 marker)."""
        x = tl[0] + (cx_pct / 100) * (tr[0] - tl[0])
        y = tl[1] + (cy_pct / 100) * (bl[1] - tl[1])
        return int(round(x)), int(round(y))

    def fill_bubble(b, extra=2):
        cx, cy = px(b.cx, b.cy)
        r = int(round(b.radius / 100 * W)) + extra
        cv2.circle(img, (cx, cy), r, (20, 20, 20), -1)

    # 4 marker góc (hình vuông đen đặc) — vẽ tại tâm marker gốc, phải là 4 contour
    # lớn nhất trên phiếu (lớn hơn cả bubble SBD đã tô) để _detect_markers chọn đúng.
    marker_side = 80
    for m in layout.markers:
        cx, cy = int(round(m.cx / 100 * W)), int(round(m.cy / 100 * H))
        half = marker_side // 2
        cv2.rectangle(img, (cx - half, cy - half), (cx + half, cy + half), (10, 10, 10), -1)

    # SBD = 123456: cột c tô chữ số SBD_TRUTH[c]
    sbd_grid = layout.get_sbd_bubbles()
    for col_idx, digit in enumerate(SBD_TRUTH):
        fill_bubble(sbd_grid[col_idx][int(digit)])

    # Mã đề = 161
    made_grid = layout.get_ma_de_bubbles()
    for col_idx, digit in enumerate(MA_DE_TRUTH):
        fill_bubble(made_grid[col_idx][int(digit)])

    # Hàng Type calibration: tô đúng pattern [5, 6, 8]
    for i, b in enumerate(layout.get_type_bubbles()):
        if i in layout.type_filled_indices:
            fill_bubble(b)

    # 120 câu hỏi
    for q in range(1, 121):
        bubbles = layout.get_question_bubbles(q)
        if q in MULTI_MARK_QUESTIONS:
            fill_bubble(bubbles[0])
            fill_bubble(bubbles[2])
        elif q not in BLANK_QUESTIONS:
            fill_bubble(bubbles[q % 4])

    # Tuỳ chọn: bóp méo nhẹ như scan thật (perspective)
    if perspective_noise > 0:
        h, w = img.shape[:2]
        n = perspective_noise
        src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
        dst = np.float32([
            [n, n], [w - n, n * 0.5], [w - n * 0.5, h - n], [n * 0.3, h - n * 0.6],
        ])
        M = cv2.getPerspectiveTransform(src, dst)
        img = cv2.warpPerspective(img, M, (w, h), borderValue=(255, 255, 255))

    return img


def expected_choice(q: int):
    if q in BLANK_QUESTIONS:
        return None
    if q in MULTI_MARK_QUESTIONS:
        return "MULTI"
    return "ABCD"[q % 4]


def verify_omr() -> None:
    section("3. KIỂM CHỨNG OMR (layout geometry + OpenCV pipeline + Hybrid engine)")
    layout = SheetLayout()

    # 3.0 Audit hình học layout
    issues = audit_layout_geometry(layout)
    check("Layout geometry: 100% bubble nằm trong khung 0-100%", len(issues) == 0,
          "; ".join(issues[:3]) if issues else "SBD 60 + MaDe 30 + Type 9 + 480 ô câu hỏi OK")

    # 3.1 Phiếu phẳng (không méo)
    print("\n  --- 3.1 Phiếu scan phẳng ---")
    sheet = generate_synthetic_sheet(layout)
    pipeline = OpenCVOMRPipeline(layout)
    res = pipeline.process(sheet)
    check("Đọc đúng SBD", res.sbd == SBD_TRUTH and res.sbd_confident, f"read='{res.sbd}'")
    check("Đọc đúng Mã đề", res.ma_de == MA_DE_TRUTH and res.ma_de_confident, f"read='{res.ma_de}'")
    check("Đọc đủ 120 câu", len(res.questions) == 120, f"n={len(res.questions)}")

    wrong = [q.question_no for q in res.questions
             if q.question_no not in MULTI_MARK_QUESTIONS and q.selected != expected_choice(q.question_no)]
    check("Đáp án đọc khớp 100% (trừ câu tô kép)", len(wrong) == 0,
          f"sai: {wrong[:8]}" if wrong else "117/117 câu đơn trúng")

    blanks_ok = all(res.questions[q - 1].selected is None and not res.questions[q - 1].needs_review
                    for q in BLANK_QUESTIONS)
    check("Câu bỏ trống → None, không needs_review oan", blanks_ok, f"câu {sorted(BLANK_QUESTIONS)}")

    multi_ok = all(res.questions[q - 1].needs_review and res.questions[q - 1].selected is None
                   for q in MULTI_MARK_QUESTIONS)
    check("Câu tô 2 ô → needs_review (chống chấm sai)", multi_ok, f"câu {sorted(MULTI_MARK_QUESTIONS)}")
    check("needs_review_count khớp số câu tô kép", res.needs_review_count == len(MULTI_MARK_QUESTIONS),
          f"count={res.needs_review_count}")

    # 3.2 Phiếu scan méo nhẹ (perspective distortion như scan thực tế)
    print("\n  --- 3.2 Phiếu scan méo nhẹ (perspective ~20px) ---")
    sheet2 = generate_synthetic_sheet(layout, perspective_noise=20)
    res2 = pipeline.process(sheet2)
    check("Vẫn đọc đúng SBD sau khi méo", res2.sbd == SBD_TRUTH, f"read='{res2.sbd}'")
    check("Vẫn đọc đúng Mã đề sau khi méo", res2.ma_de == MA_DE_TRUTH, f"read='{res2.ma_de}'")
    wrong2 = [q.question_no for q in res2.questions
              if q.question_no not in MULTI_MARK_QUESTIONS
              and q.selected != expected_choice(q.question_no)
              and not q.needs_review]
    check("Đáp án sau méo: 0 câu SAI im lặng (sai thì phải needs_review)", len(wrong2) == 0,
          f"sai im lặng: {wrong2[:8]}" if wrong2 else "OK")

    # 3.3 Hybrid engine (đúng đường đi production: tasks.py dùng HybridOMREngine)
    print("\n  --- 3.3 HybridOMREngine (Gemini tắt) ---")
    engine = HybridOMREngine(layout=layout, enable_gemini=False)
    hres = engine.process_image(sheet)
    d = engine.to_dict(hres)
    check("Hybrid to_dict đủ khoá lưu DB",
          all(k in d for k in ("sbd", "ma_de", "questions", "needs_review_count", "processing_time_ms")))
    check("Hybrid đọc đúng SBD + Mã đề", d["sbd"] == SBD_TRUTH and d["ma_de"] == MA_DE_TRUTH,
          f"sbd='{d['sbd']}', ma_de='{d['ma_de']}', {d['processing_time_ms']:.0f}ms")
    check("Hybrid needs_review_count == 2", d["needs_review_count"] == len(MULTI_MARK_QUESTIONS),
          f"count={d['needs_review_count']}")

    # Lưu ảnh phiếu tổng hợp để review trực quan
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "verify_omr_sheet.png")
    cv2.imwrite(out, sheet)
    print(f"\n  (Đã lưu phiếu tổng hợp: {out})")


def main() -> int:
    print("KIỂM CHỨNG IRT / CTT / OMR — MIT EXAMS")
    rng = np.random.default_rng(SEED)
    N, J = 600, 20
    true_a = rng.uniform(0.7, 1.8, J)
    true_b = np.sort(rng.uniform(-1.5, 1.5, J))
    true_theta = rng.normal(0.0, 1.0, N)
    P = 1.0 / (1.0 + np.exp(-1.702 * true_a[None, :] * (true_theta[:, None] - true_b[None, :])))
    U = (rng.random((N, J)) < P).astype(float)

    verify_irt()
    verify_ctt(U)
    verify_omr()

    section("TỔNG KẾT")
    failed = [r for r in results_log if r[1] == "FAIL"]
    print(f"  Tổng số check: {len(results_log)} — PASS: {len(results_log) - len(failed)} — FAIL: {len(failed)}")
    for name, _, detail in failed:
        print(f"  ✗ {name} — {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())


