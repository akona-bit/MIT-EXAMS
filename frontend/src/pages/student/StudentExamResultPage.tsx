import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  EyeOff,
  ListChecks,
  Lock,
  XCircle,
  Trophy,
  Info
} from "lucide-react";
import Button from "../../components/ui/Button";
import LoadingScreen from "../../components/ui/LoadingScreen";
import {
  getStudentExamResult,
  type ReviewQuestion,
  type StudentExamResult,
} from "../../api/studentExamResult";
import { getMaintenanceStatus, type MaintenanceStatus } from "../../api/system";
import MaintenanceScreen from "../../components/ui/MaintenanceScreen";

type ReviewFilter = "all" | "wrong" | "skipped";

const containerAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemAnim = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 280, damping: 24 } },
};

export default function StudentExamResultPage() {
  const { examId } = useParams();
  const [result, setResult] = useState<StudentExamResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [maintenance, setMaintenance] = useState<MaintenanceStatus | null>(null);

  const loadResult = useCallback(async () => {
    if (!examId) return;
    setIsLoading(true);
    setError("");
    setErrorStatus(null);
    try {
      const data = await getStudentExamResult(Number(examId));
      setResult(data);
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { status?: number; data?: { detail?: string } } })
              .response?.status ?? null
          : null;
      const detail =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setErrorStatus(status);
      setError(detail || "Không tải được kết quả. Vui lòng thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const status = await getMaintenanceStatus();
        setMaintenance(status);
        if (!status.maintenance_mode_all && !status.maintenance_mode_result) {
          loadResult();
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        loadResult();
      }
    };
    checkMaintenance();
  }, [loadResult]);

  // --- Trạng thái chờ / lỗi ---
  if (maintenance?.maintenance_mode_all || maintenance?.maintenance_mode_result) {
    return <MaintenanceScreen />;
  }

  if (isLoading) {
    return <LoadingScreen message="Đang tải kết quả của bạn..." />;
  }

  if (error || !result) {
    const blockedWhileExam = errorStatus === 403;
    return (
      <div className="min-h-screen text-slate-900 bg-slate-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 mb-6">
            {blockedWhileExam ? (
              <Clock className="h-8 w-8 text-amber-500" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            )}
          </div>
          <h1 className="text-xl font-bold mb-3 text-slate-800">
            {blockedWhileExam ? "Bài thi chưa được nộp" : "Không xem được kết quả"}
          </h1>
          <p className="text-sm leading-relaxed text-slate-500 mb-8">{error}</p>
          <Link to="/student">
            <Button className="w-full bg-slate-800 hover:bg-slate-900 text-white">Quay lại trang chủ</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-900 bg-slate-50">
      <ResultContent
        result={result}
        reviewFilter={reviewFilter}
        onFilterChange={setReviewFilter}
      />
    </div>
  );
}

function ResultContent({
  result,
  reviewFilter,
  onFilterChange,
}: {
  result: StudentExamResult;
  reviewFilter: ReviewFilter;
  onFilterChange: (f: ReviewFilter) => void;
}) {
  const { raw_scores, true_score, can_view_answers } = result;

  // Nếu thí sinh chưa có quyền xem điểm (không có can_view_answers), ta CHỈ HIỂN THỊ màn hình chờ kết quả
  if (!can_view_answers) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl shadow-indigo-500/10 border border-slate-100 text-center"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 mb-6">
            <CheckCircle2 className="h-10 w-10 text-white" />
          </div>
          
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Nộp bài thành công!
          </h1>
          
          <div className="bg-slate-50 rounded-2xl p-4 my-6 border border-slate-100 text-left">
            <div className="flex gap-3 text-slate-600 text-sm mb-2">
              <span className="font-semibold w-24 shrink-0">Kỳ thi:</span>
              <span>{result.exam_name}</span>
            </div>
            <div className="flex gap-3 text-slate-600 text-sm">
              <span className="font-semibold w-24 shrink-0">Trạng thái:</span>
              <span className={result.is_suspended ? "text-rose-600 font-semibold" : "text-emerald-600 font-semibold"}>
                {result.is_suspended ? "Bị đình chỉ" : "Đã nộp bài"}
              </span>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-8 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Lock className="w-16 h-16 text-indigo-900" />
            </div>
            <div className="flex items-start gap-3 relative z-10">
              <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-indigo-900 text-sm mb-1">Chờ kết quả & đáp án</h3>
                <p className="text-indigo-800 text-sm leading-relaxed">
                  Hệ thống đang lưu trữ bài làm của bạn. Điểm thi chi tiết và đáp án sẽ được cập nhật sau.
                </p>
                <p className="text-indigo-600 text-xs mt-3 font-medium bg-indigo-100/50 inline-block px-2 py-1 rounded">
                  * Dành riêng cho thí sinh đã thanh toán lệ phí thi.
                </p>
              </div>
            </div>
          </div>

          <Link to="/student">
            <Button size="lg" className="w-full bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-900/20">
              Quay lại trang chủ
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // --- Nếu CÓ quyền xem điểm ---
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 lg:px-8">
        <motion.div variants={containerAnim} initial="hidden" animate="show">
          {/* Tiêu đề + trạng thái */}
          <motion.div variants={itemAnim} className="mb-6">
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">Kết quả bài thi</h1>
            <p className="mt-1 text-sm text-slate-500">
              {result.exam_name || `Kỳ thi #${result.exam_id}`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {result.is_suspended ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Phiên thi bị đình chỉ — điểm phần đã làm
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Đã nộp bài
                </span>
              )}
            </div>
          </motion.div>


          {/* Điểm tổng (điểm thô) */}
          <motion.div
            variants={itemAnim}
            className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tổng điểm thô
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-5xl font-black tracking-tighter text-primary-600">
                    {formatNumber(raw_scores.total)}
                  </span>
                  <span className="text-lg font-bold text-slate-400">/ {raw_scores.max_total}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Đã trả lời {raw_scores.answered_count}/{raw_scores.total_questions} câu
                </p>
              </div>
              <div className="rounded-2xl bg-primary-50 px-5 py-3 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Phương pháp
                </p>
                <p className="mt-1 text-2xl font-black text-primary-700">
                  {raw_scores.method}
                </p>
              </div>
            </div>
          </motion.div>


          {/* Điểm từng phần */}
          <motion.div variants={itemAnim} className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <BookOpenCheck className="h-5 w-5 text-primary-500" />
              Điểm theo phần thi
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {raw_scores.parts.map((part) => (
                <div
                  key={part.part}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Phần {part.part} · {part.label}
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight">
                    {formatNumber(part.raw_score)}
                    <span className="text-sm font-bold text-slate-400">/{part.max_raw_score}</span>
                  </p>
                  {true_score.available && part.irt_score !== null ? (
                    <p className="mt-1 text-xs font-semibold text-primary-600">
                      Quy đổi IRT: {formatNumber(part.irt_score)}/300
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Điểm thực (IRT) — chỉ hiện khi đủ điều kiện */}
          <TrueScoreSection trueScore={true_score} />


          {/* Xem lại bài làm */}
          <motion.div variants={itemAnim}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <ListChecks className="h-5 w-5 text-primary-500" />
              Xem lại bài làm
            </h2>
            {!result.review ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5">
                <EyeOff className="h-5 w-5 text-slate-400" />
                <p className="text-sm text-slate-500">
                  Chưa có dữ liệu xem lại cho bài làm này.
                </p>
              </div>
            ) : (
              <ReviewList
                review={result.review}
                filter={reviewFilter}
                onFilterChange={onFilterChange}
              />
            )}
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function TrueScoreSection({ trueScore }: { trueScore: StudentExamResult["true_score"] }) {
  return (
    <motion.div
      variants={itemAnim}
      className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Trophy className="h-5 w-5 text-amber-500" />
        Điểm thực (quy đổi 0–1200)
      </h2>

      {trueScore.available ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-4xl font-black tracking-tighter text-amber-600">
              {formatNumber(trueScore.irt_total ?? 0)}
            </span>
            <span className="text-sm font-bold text-slate-400">/ 1200</span>
          </div>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Điểm chính thức theo IRT
          </p>
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 border border-amber-100">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {trueScore.state === "computing"
                ? "Đang chờ tính toán"
                : trueScore.state === "not_enough_data"
                  ? "Kỳ thi chưa đủ dữ liệu"
                  : "Chưa có điểm thực"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {trueScore.message}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

const STATUS_STYLES: Record<ReviewQuestion["status"], { ring: string; badge: string; label: string }> = {
  correct: {
    ring: "border-emerald-500/40",
    badge: "bg-emerald-500/10 text-emerald-600",
    label: "Đúng",
  },
  wrong: {
    ring: "border-rose-500/40",
    badge: "bg-rose-500/10 text-rose-600",
    label: "Sai",
  },
  penalized: {
    ring: "border-rose-500/40",
    badge: "bg-rose-500/10 text-rose-600",
    label: "Trừ điểm",
  },
  skipped: {
    ring: "border-slate-200",
    badge: "bg-slate-100 text-slate-500",
    label: "Bỏ trống",
  },
};


function ReviewList({
  review,
  filter,
  onFilterChange,
}: {
  review: ReviewQuestion[];
  filter: ReviewFilter;
  onFilterChange: (f: ReviewFilter) => void;
}) {
  const filtered = review.filter((q) => {
    if (filter === "wrong") return q.status === "wrong" || q.status === "penalized";
    if (filter === "skipped") return q.status === "skipped";
    return true;
  });

  const wrongCount = review.filter(
    (q) => q.status === "wrong" || q.status === "penalized",
  ).length;
  const skippedCount = review.filter((q) => q.status === "skipped").length;

  const filters: { key: ReviewFilter; label: string; count?: number }[] = [
    { key: "all", label: "Tất cả" },
    { key: "wrong", label: "Sai", count: wrongCount },
    { key: "skipped", label: "Bỏ trống", count: skippedCount },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onFilterChange(f.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === f.key
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/25"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
            {f.count !== undefined && (
              <span className="rounded-full bg-black/10 px-1.5 text-xs">
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((q) => (
          <QuestionReviewCard key={q.position} question={q} />
        ))}
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Không có câu nào trong mục này.
          </p>
        )}
      </div>
    </div>
  );
}

function QuestionReviewCard({ question }: { question: ReviewQuestion }) {
  const style = STATUS_STYLES[question.status];
  const selectedIds = new Set(question.selected_answer_ids);
  const subAnswers = question.selected_subitem_answers || {};

  const isSubItemQuestion =
    (question.question_type === "TRUE_FALSE" ||
      question.question_type === "COMPOSITE") &&
    question.options.some((opt) => opt.sub_item_id != null);

  // Lựa chọn của thí sinh cho 1 ý con (key JSON là string, value là int hoặc array)
  const getSubSelection = (subItemId: number): number[] => {
    const v = subAnswers[String(subItemId)] ?? (subAnswers as any)[subItemId];
    if (v == null) return [];
    return Array.isArray(v) ? v.map(Number) : [Number(v)];
  };

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${style.ring}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Câu {question.position} · {question.part_label}
        </p>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}
        >
          {question.status === "correct" ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : question.status === "skipped" ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {style.label}
        </span>
      </div>

      {question.content && (
        <p className="mt-2 text-sm leading-relaxed text-slate-800 font-medium">{question.content}</p>
      )}

      {/* ─── Câu có ý con: TRUE_FALSE / COMPOSITE ─── */}
      {isSubItemQuestion && (
        <div className="mt-4 space-y-3">
          {Array.from(
            new Map(
              question.options
                .filter((opt) => opt.sub_item_id != null)
                .map((opt) => [opt.sub_item_id, opt])
            ).values()
          ).map((head) => {
            const subItemId = head.sub_item_id as number;
            const subOptions = question.options.filter(
              (opt) => opt.sub_item_id === subItemId
            );
            const subSelection = new Set(getSubSelection(subItemId));
            const anySelected = subSelection.size > 0;
            return (
              <div
                key={subItemId}
                className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <p className="text-sm font-medium text-slate-700">
                  {head.sub_item_label && (
                    <span className="mr-1.5 font-bold text-slate-900">{head.sub_item_label})</span>
                  )}
                  {head.sub_item_prompt || "..."}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {subOptions.map((opt) => {
                    const isSelected = subSelection.has(opt.answer_id);
                    return (
                      <span
                        key={opt.answer_id}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          opt.is_correct
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                            : isSelected
                              ? "bg-rose-100 text-rose-700 border border-rose-200"
                              : "bg-white border border-slate-200 text-slate-500"
                        }`}
                      >
                        {opt.content}
                        {opt.is_correct && " ✓"}
                        {!opt.is_correct && isSelected && " ✗"}
                      </span>
                    );
                  })}
                </div>
                {!anySelected && (
                  <p className="mt-2 text-xs italic text-slate-400">Bỏ trống</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── FILL_IN_BLANK: đáp án text của thí sinh + đáp án đúng ─── */}
      {!isSubItemQuestion && question.question_type === "FILL_IN_BLANK" && (
        <div className="mt-4 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <p className="text-sm">
            <span className="text-slate-500">Câu trả lời của bạn: </span>
            <span
              className={
                question.status === "correct"
                  ? "font-bold text-emerald-600"
                  : "font-bold text-rose-600"
              }
            >
              {question.text_answer || "(bỏ trống)"}
            </span>
          </p>
          {question.status !== "correct" && (
            <p className="text-sm border-t border-slate-200 pt-2 mt-2">
              <span className="text-slate-500">Đáp án đúng: </span>
              <span className="font-bold text-emerald-600">
                {question.options
                  .filter((opt) => opt.is_correct)
                  .map((opt) => opt.content)
                  .join(" / ") || "—"}
              </span>
            </p>
          )}
        </div>
      )}

      {/* ─── Trắc nghiệm thường ─── */}
      {!isSubItemQuestion && question.question_type !== "FILL_IN_BLANK" && (
      <div className="mt-4 grid gap-2">
        {question.options.map((opt) => {
          const isSelected = selectedIds.has(opt.answer_id);
          return (
            <div
              key={opt.answer_id}
              className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm border ${
                opt.is_correct
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : isSelected
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : "bg-white border-slate-100 text-slate-600"
              }`}
            >
              <span className={`font-bold flex items-center justify-center w-6 h-6 rounded-full text-xs shrink-0 ${
                opt.is_correct ? "bg-emerald-200 text-emerald-800" : isSelected ? "bg-rose-200 text-rose-800" : "bg-slate-100 text-slate-500"
              }`}>{opt.label}</span>
              <span className="mt-0.5">{opt.content}</span>
              {opt.is_correct && (
                <span className="ml-auto shrink-0 text-xs font-bold text-emerald-600 mt-1">Đúng</span>
              )}
              {!opt.is_correct && isSelected && (
                <span className="ml-auto shrink-0 text-xs font-bold text-rose-600 mt-1">Bạn chọn</span>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
