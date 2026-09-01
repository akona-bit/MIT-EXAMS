import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMatrix, checkMatrixFeasibility } from "../../api/matrix";
import type { Matrix } from "../../types";
import Button from "../../components/ui/Button";
import DataTable, { type Column } from "../../components/ui/DataTable";
import MatrixDistributionCharts from "../../components/admin/MatrixDistributionCharts";
import { CheckCircle, XCircle, Loader2, ShieldCheck } from "lucide-react";

export default function MatrixDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Feasibility check state
  const [isChecking, setIsChecking] = useState(false);
  const [feasibilityResult, setFeasibilityResult] = useState<{ feasible: boolean; message: string; shortages?: string[] } | null>(null);

  useEffect(() => {
    if (!id) return;
    getMatrix(Number(id))
      .then(setMatrix)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleFeasibilityCheck = async () => {
    if (!id) return;
    setIsChecking(true);
    setFeasibilityResult(null);
    try {
      const result = await checkMatrixFeasibility(Number(id));
      setFeasibilityResult({
        feasible: result.feasible,
        message: result.message || (result.feasible ? "Ma trận khả thi" : "Ma trận thất bại"),
        shortages: result.shortages,
      });
    } catch (error: any) {
      setFeasibilityResult({
        feasible: false,
        message: error.response?.data?.detail || "Có lỗi xảy ra khi kiểm tra",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const columns: Column<any>[] = [
    { key: "knowledge_node_id", header: "Kiến thức", render: (val) => `Node #${val}` },
    {
      key: "level",
      header: "Mức độ",
      render: (val) => {
        const levels: Record<number, string> = { 1: "NB", 2: "TH", 3: "VD", 4: "VDC" };
        return levels[val] || val || "—";
      },
    },
    { key: "question_type", header: "Dạng câu", render: (val) => val || "—" },
    { key: "count", header: "Số câu" },
    {
      key: "part",
      header: "Phần",
      render: (val) => {
        const parts: Record<number, string> = { 1: "Tiếng Việt", 2: "Tiếng Anh", 3: "Toán", 4: "Khoa học" };
        return parts[val] || `Phần ${val}`;
      },
    },
    { key: "group_id", header: "Nhóm", render: (val) => val ? `#${val}` : "—" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!matrix) {
    return (
      <div className="text-center p-8">
        <p>Không tìm thấy ma trận</p>
        <Button onClick={() => navigate("/admin/matrix")}>Quay lại</Button>
      </div>
    );
  }

  const totalQuestions = matrix.rules?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">{matrix.name}</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            {matrix.description || "Không có mô tả"} — {matrix.rules?.length || 0} ô, {totalQuestions} câu hỏi
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(`/admin/matrix/${id}/edit`)}>
            Sửa ma trận
          </Button>
          <Button variant="ghost" onClick={() => navigate("/admin/matrix")}>
            Quay lại
          </Button>
        </div>
      </div>

      {/* Feasibility Check */}
      <div className="glass-card p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-500/10">
              <ShieldCheck className="h-5 w-5 text-primary-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Kiểm tra khả thi</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chạy thử thuật toán sinh đề mà không lưu kết quả thật
              </p>
            </div>
          </div>
          <Button
            onClick={handleFeasibilityCheck}
            disabled={isChecking}
            className="min-w-[180px]"
          >
            {isChecking ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang kiểm tra...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Kiểm tra khả thi
              </span>
            )}
          </Button>
        </div>

        {feasibilityResult && (
          <div className={`mt-4 p-4 rounded-xl border ${
            feasibilityResult.feasible
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {feasibilityResult.feasible ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className={`font-semibold ${
                feasibilityResult.feasible ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
              }`}>
                {feasibilityResult.message}
              </span>
            </div>
            {feasibilityResult.shortages && feasibilityResult.shortages.length > 0 && (
              <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 space-y-1 mt-2">
                {feasibilityResult.shortages.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Distribution Charts */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Biểu đồ phân phối</h2>
        <MatrixDistributionCharts rules={matrix.rules} />
      </div>

      {/* Rules Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Chi tiết quy tắc</h2>
        <div className="p-0 overflow-hidden glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-2xl">
          <DataTable data={matrix.rules} columns={columns} keyExtractor={(item) => item.id} />
        </div>
      </div>
    </div>
  );
}
