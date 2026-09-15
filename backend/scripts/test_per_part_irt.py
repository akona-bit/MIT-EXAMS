"""Test per-part IRT flow with synthetic data — simulates what scorer.py does."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import pandas as pd
from app.services.grading.irt_engine import mmle, theta_estimate_eap, true_score, all_item_se, chi_square

SEED = 42
np.random.seed(SEED)

N, J_PART = 250, 30
PART_NAMES = ["TV", "TA", "Toan", "TDKH"]
results_log = []


def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results_log.append((name, status, detail))
    print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))


def test_per_part():
    print("=" * 64)
    print("TEST: Per-part IRT (MMLE + EAP + TrueScore + SE + ChiSquare)")
    print("=" * 64)

    # Store per-part results for aggregation test
    all_a_est = {}
    all_b_est = {}
    all_theta = {}

    for pi, pname in enumerate(PART_NAMES):
        print(f"\n--- Part {pi+1}: {pname} ({J_PART} items, N={N}) ---")
        true_a = np.random.uniform(0.7, 1.8, J_PART)
        true_b = np.sort(np.random.uniform(-1.5, 1.5, J_PART))
        true_theta = np.random.normal(0, 1, N)

        P = 1 / (1 + np.exp(-1.702 * true_a[None, :] * (true_theta[:, None] - true_b[None, :])))
        U = (np.random.random((N, J_PART)) < P).astype(float)

        # 1. MMLE per-part
        a_est, b_est = mmle(U, name=f"TEST_P{pi+1}", max_iter=20, K=21, verbose=False)
        corr_b = float(np.corrcoef(true_b, b_est)[0, 1])
        check(f"P{pi+1} MMLE corr_b > 0.85", corr_b > 0.85, f"corr={corr_b:.3f}")
        check(f"P{pi+1} a in range", bool(np.all((a_est > 0.05) & (a_est < 3.0))),
              f"a=[{a_est.min():.2f}, {a_est.max():.2f}]")

        all_a_est[pi] = a_est
        all_b_est[pi] = b_est

        # 2. EAP theta per-part
        U_float = U.copy()
        U_float[U_float == -1] = 0
        item_params = [(float(a_est[k]), float(b_est[k])) for k in range(J_PART)]
        theta_est = np.array(theta_estimate_eap(U_float, item_params, 41))
        corr_theta = float(np.corrcoef(true_theta, theta_est)[0, 1])
        check(f"P{pi+1} EAP corr_theta > 0.85", corr_theta > 0.85, f"corr={corr_theta:.3f}")
        check(f"P{pi+1} EAP std > 0.3", float(np.std(theta_est)) > 0.3,
              f"std={np.std(theta_est):.3f}")

        all_theta[pi] = theta_est

        # 3. True score per-part
        cau_names = [f"Q_{pi*J_PART+k}" for k in range(J_PART)]
        params_df = pd.DataFrame(item_params, columns=["a", "b"], index=cau_names)
        ts_scores = []
        for i in range(N):
            sd = pd.Series(U_float[i], index=cau_names)
            ts = true_score(float(theta_est[i]), int(sd.sum()), sd, params_df)
            ts_scores.append(ts)
        check(f"P{pi+1} true_score in [0, 300]",
              all(0 <= s <= 300 for s in ts_scores),
              f"min={min(ts_scores)}, max={max(ts_scores)}, mean={np.mean(ts_scores):.1f}")

        # 4. Item SE per-part
        se_matrix = np.asarray(all_item_se(item_params))
        check(f"P{pi+1} item_se shape correct",
              se_matrix.ndim == 2 and se_matrix.shape == (J_PART, 2),
              f"shape={se_matrix.shape}")
        check(f"P{pi+1} SE finite and positive",
              bool(np.all(np.isfinite(se_matrix)) and np.all(se_matrix > 0)),
              f"se_a=[{se_matrix[:,0].min():.3f}, {se_matrix[:,0].max():.3f}]")

        # 5. Chi-square per-part
        U_df = pd.DataFrame(U, columns=cau_names)
        U_df["Theta"] = theta_est
        chi2_df = chi_square(U_df, params_df)
        check(f"P{pi+1} chi_square rows = {J_PART}", len(chi2_df) == J_PART, f"rows={len(chi2_df)}")
        fit_ratio = float((chi2_df["p_value"] > 0.05).mean())
        check(f"P{pi+1} chi-square fit > 60%", fit_ratio > 0.6,
              f"{fit_ratio*100:.0f}% items p>0.05")

    # Aggregation test (simulates what scorer.py does)
    print(f"\n{'='*64}")
    print("AGGREGATION TEST (simulates scorer.py finalize)")
    print("=" * 64)
    total_scores = []
    for i in range(N):
        parts = []
        for pi in range(4):
            cau_names = [f"Q_{pi*J_PART+k}" for k in range(J_PART)]
            params_df = pd.DataFrame(
                [(float(all_a_est[pi][k]), float(all_b_est[pi][k])) for k in range(J_PART)],
                columns=["a", "b"], index=cau_names
            )
            U_float_i = np.zeros((1, J_PART))
            sd = pd.Series(U_float_i[0], index=cau_names)
            ts = true_score(float(all_theta[pi][i]), 0, sd, params_df)
            parts.append(ts)
        total_scores.append(sum(parts))

    check("Total score in [0, 1200]",
          all(0 <= s <= 1200 for s in total_scores),
          f"min={min(total_scores)}, max={max(total_scores)}")


def test_edge_cases():
    print(f"\n{'='*64}")
    print("EDGE CASE TESTS")
    print("=" * 64)

    # Part with all correct answers
    U_all_correct = np.ones((100, 30))
    try:
        a, b = mmle(U_all_correct, name="EDGE_ALL_CORRECT", max_iter=10, K=21, verbose=False)
        check("MMLE all-correct doesn't crash", True)
    except Exception as e:
        check("MMLE all-correct doesn't crash", False, str(e))

    # Part with all wrong answers
    U_all_wrong = np.zeros((100, 30))
    try:
        a, b = mmle(U_all_wrong, name="EDGE_ALL_WRONG", max_iter=10, K=21, verbose=False)
        check("MMLE all-wrong doesn't crash", True)
    except Exception as e:
        check("MMLE all-wrong doesn't crash", False, str(e))

    # Part with 50% missing
    U_half_missing = np.random.choice([0, 1, -1], size=(100, 30), p=[0.25, 0.25, 0.5])
    try:
        a, b = mmle(U_half_missing, name="EDGE_HALF_MISSING", max_iter=10, K=21, verbose=False)
        check("MMLE 50% missing doesn't crash", True)
    except Exception as e:
        check("MMLE 50% missing doesn't crash", False, str(e))

    # theta_estimate_eap with all zeros
    U_zeros = np.zeros((10, 30))
    item_params = [(1.0, 0.0)] * 30
    try:
        theta = theta_estimate_eap(U_zeros, item_params, 21)
        check("EAP all-zeros doesn't crash", len(theta) == 10)
    except Exception as e:
        check("EAP all-zeros doesn't crash", False, str(e))


if __name__ == "__main__":
    test_per_part()
    test_edge_cases()

    print(f"\n{'='*64}")
    print("TỔNG KẾT")
    print("=" * 64)
    failed = [r for r in results_log if r[1] == "FAIL"]
    print(f"  Tổng: {len(results_log)} checks — PASS: {len(results_log) - len(failed)} — FAIL: {len(failed)}")
    for name, _, detail in failed:
        print(f"  FAIL: {name} — {detail}")
    sys.exit(1 if failed else 0)
