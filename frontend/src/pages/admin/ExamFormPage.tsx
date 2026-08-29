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
          <p className="text-sm font-medium text-primary-600">Exam setup</p>
          <h1 className="text-2xl font-bold text-neutral-900">
            Tạo kỳ thi mới
          </h1>
        </div>
        <Button variant="ghost" onClick={() => navigate("/admin/exams")}>
          Quay lại
        </Button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
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
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Mô tả
          </label>
          <textarea
            id="exam-description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Mục tiêu, đối tượng hoặc ghi chú cho kỳ thi"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="exam-matrix"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Ma trận đặc tả
            </label>
            <select
              id="exam-matrix"
              required
              value={matrixId}
              onChange={(event) => setMatrixId(event.target.value)}
              disabled={isFetching}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-neutral-50"
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
              className="mb-1.5 block text-sm font-medium text-neutral-700"
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
              className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              Đề gốc sẽ được tạo kèm các mã đề xáo trộn.
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-neutral-100 pt-4">
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={isFetching || matrices.length === 0}
          >
            Tạo kỳ thi
          </Button>
        </div>
      </form>
    </div>
  );
}
