import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateExam } from "../../api/exams";
import { getMatrices } from "../../api/matrix";
import type { Matrix } from "../../types";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

export default function ExamFormPage() {
  const navigate = useNavigate();
  const [matrices, setMatrices] = useState<Matrix[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [matrixId, setMatrixId] = useState("");
  const [formCount, setFormCount] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    getMatrices(0, 100)
      .then((data) => setMatrices(data.items))
      .catch((error) => {
        console.error(error);
        setErrorMessage("Không thể tải danh sách ma trận");
      })
      .finally(() => setIsFetching(false));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    if (!name.trim() || !matrixId) {
      setErrorMessage("Vui lòng nhập tên kỳ thi và chọn ma trận");
      return;
    }

    setIsLoading(true);
    try {
      const exam = await generateExam({
        matrix_id: Number(matrixId),
        exam_name: name.trim(),
        exam_description: description.trim() || undefined,
        number_of_forms: formCount,
      });
      navigate(`/admin/exams/${exam.id}`);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Không thể tạo kỳ thi. Hãy kiểm tra ma trận đã đủ câu hỏi được duyệt.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-primary-500">Exam setup</p>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">
            Tạo kỳ thi mới
          </h1>
        </div>
        <Button variant="ghost" onClick={() => navigate("/admin/exams")}>
          Quay lại
        </Button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl glass-card p-6"
      >
        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-500"
          >
            {errorMessage}
          </div>
        )}

        <Input
          label="Tên kỳ thi"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ví dụ: ĐGNL tháng 9 - Đợt 1"
          required
        />

        <div>
          <label
            htmlFor="exam-description"
            className="mb-1.5 block text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            Mô tả
          </label>
          <textarea
            id="exam-description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Mục tiêu, đối tượng hoặc ghi chú cho kỳ thi"
            className="w-full px-4 py-2.5 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 rounded-xl shadow-[0_4px_12px_rgb(0,0,0,0.05)] focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all outline-none backdrop-blur-md"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="exam-matrix"
              className="mb-1.5 block text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              Ma trận đặc tả
            </label>
            <select
              id="exam-matrix"
              required
              value={matrixId}
              onChange={(event) => setMatrixId(event.target.value)}
              disabled={isFetching}
              className="w-full px-4 py-2.5 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 rounded-xl shadow-[0_4px_12px_rgb(0,0,0,0.05)] focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all outline-none backdrop-blur-md disabled:opacity-50"
            >
              <option value="">
                {isFetching ? "Đang tải ma trận..." : "-- Chọn ma trận --"}
              </option>
              {matrices.map((matrix) => (
                <option key={matrix.id} value={matrix.id}>
                  {matrix.name}
                </option>
              ))}
            </select>
            {!isFetching && matrices.length === 0 && (
              <p className="mt-1.5 text-xs text-warning-600">
                Chưa có ma trận. Hãy tạo ma trận trước.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="form-count"
              className="mb-1.5 block text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              Số mã đề
            </label>
            <input
              id="form-count"
              type="number"
              min={1}
              max={100}
              value={formCount}
              onChange={(event) =>
                setFormCount(Math.max(1, Number(event.target.value)))
              }
              className="w-full px-4 py-2.5 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 rounded-xl shadow-[0_4px_12px_rgb(0,0,0,0.05)] focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all outline-none backdrop-blur-md"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Đề gốc sẽ được tạo kèm các mã đề xáo trộn.
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 dark:border-white/10 pt-4">
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={isFetching || matrices.length === 0}
            size="lg"
            className="shadow-lg shadow-primary-500/30 hover:-translate-y-0.5"
          >
            Tạo kỳ thi
          </Button>
        </div>
      </form>
    </div>
  );
}
