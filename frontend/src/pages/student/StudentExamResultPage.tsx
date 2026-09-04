import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  EyeOff,
  Loader2,
  ListChecks,
  Lock,
  XCircle,
} from "lucide-react";
import Button from "../../components/ui/Button";
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
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Đang tải kết quả của bạn...
        </p>
      </div>
    );
  }

  if (error || !result) {
    const blockedWhileExam = errorStatus === 403;
    return (
      <div className="student-shell min-h-screen text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
            {blockedWhileExam ? (
              <Clock className="h-7 w-7 text-amber-500" />
            ) : (
              <AlertTriangle className="h-7 w-7 text-amber-500" />
            )}
          </div>
          <h1 className="text-xl font-bold">
            {blockedWhileExam ? "Bài thi chưa được nộp" : "Không xem được kết quả"}
          </h1>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{error}</p>
          <Link to="/student">
            <Button variant="outline">Quay lại trang chủ</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="student-shell min-h-screen text-slate-900 dark:bg-slate-950 dark:text-slate-100">
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
  const { raw_scores, true_score } = result;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 lg:px-8">
        <motion.div variants={containerAnim} initial="hidden" animate="show">
          {/* Tiêu đề + trạng thái */}
          <motion.div variants={itemAnim} className="mb-6">
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">Kết quả bài thi</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {result.exam_name || `Kỳ thi #${result.exam_id}`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {result.is_suspended ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-danger-500/20 bg-danger-500/10 px-3 py-1 text-xs font-bold text-danger-600 dark:text-danger-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Phiên thi bị đình chỉ — điểm phần đã làm
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success-500/20 bg-success-500/10 px-3 py-1 text-xs font-bold text-success-600 dark:text-success-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Đã nộp bài
                </span>
              )}
            </div>
          </motion.div>


          {/* Điểm tổng (điểm thô) */}
          <motion.div
            variants={itemAnim}
            className="mb-6 overflow-hidden rounded-3xl border border-slate-200/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70"
          >
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tổng điểm thô
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-5xl font-black tracking-tighter text-primary-500">
                    {formatNumber(raw_scores.total)}
                  </span>
                  <span className="text-lg font-bold text-slate-400">/ {raw_scores.max_total}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Đã trả lời {raw_scores.answered_count}/{raw_scores.total_questions} câu
                </p>
              </div>
              <div className="rounded-2xl bg-primary-500/5 px-5 py-3 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Phương pháp
                </p>
                <p className="mt-1 text-2xl font-black text-primary-600 dark:text-primary-400">
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
                  className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Phần {part.part} · {part.label}
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight">
                    {formatNumber(part.raw_score)}
                    <span className="text-sm font-bold text-slate-400">/{part.max_raw_score}</span>
                  </p>
                  {true_score.available && part.irt_score !== null ? (
                    <p className="mt-1 text-xs font-semibold text-primary-600 dark:text-primary-400">
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
            {!result.can_view_answers ? (
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/60 bg-white/70 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-sm font-semibold">Tính năng xem đáp án chưa được mở</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    Quyền xem đáp án và giải thích do ban tổ chức kỳ thi cấp cho từng tài khoản.
                    Vui lòng liên hệ giáo viên nếu bạn cần xem lại bài làm chi tiết.
                  </p>
                </div>
              </div>
            ) : !result.review ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-white/70 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
                <EyeOff className="h-5 w-5 text-slate-400" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
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
      className="mb-6 rounded-3xl border border-slate-200/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70"
    >
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <BookOpenCheck className="h-5 w-5 text-primary-500" />
        Điểm thực (quy đổi 0–1200)
      </h2>

      {trueScore.available ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-4xl font-black tracking-tighter text-primary-600 dark:text-primary-400">
              {formatNumber(trueScore.irt_total ?? 0)}
            </span>
            <span className="text-sm font-bold text-slate-400">/ 1200</span>
          </div>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-success-500/20 bg-success-500/10 px-3 py-1 text-xs font-bold text-success-600 dark:text-success-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Điểm chính thức theo IRT
          </p>
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-3 rounded-2xl bg-amber-500/5 p-4">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {trueScore.state === "computing"
                ? "Đang chờ tính toán"
                : trueScore.state === "not_enough_data"
                  ? "Kỳ thi chưa đủ dữ liệu"
                  : "Chưa có điểm thực"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
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
    ring: "border-success-500/40",
    badge: "bg-success-500/10 text-success-600 dark:text-success-400",
    label: "Đúng",
  },
  wrong: {
    ring: "border-danger-500/40",
    badge: "bg-danger-500/10 text-danger-600 dark:text-danger-400",
    label: "Sai",
  },
  penalized: {
    ring: "border-danger-500/40",
    badge: "bg-danger-500/10 text-danger-600 dark:text-danger-400",
    label: "Trừ điểm",
  },
  skipped: {
    ring: "border-slate-200/60 dark:border-white/10",
    badge: "bg-slate-500/10 text-slate-500 dark:text-slate-400",
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
                ? "bg-primary-500 text-white shadow-md shadow-primary-500/25"
                : "border border-slate-200/60 bg-white/70 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {f.label}
            {f.count !== undefined && (
              <span className="rounded-full bg-black/10 px-1.5 text-xs dark:bg-white/10">
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
          <p className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 text-sm text-slate-500 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-400">
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
      className={`rounded-2xl border bg-white/70 p-4 backdrop-blur-xl dark:bg-slate-900/70 ${style.ring}`}
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
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed">{question.content}</p>
      )}

      {/* ─── Câu có ý con: TRUE_FALSE / COMPOSITE ─── */}
      {isSubItemQuestion && (
        <div className="mt-3 space-y-2.5">
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
                className="rounded-xl border border-slate-200/70 px-3 py-2.5 dark:border-white/10"
              >
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {head.sub_item_label && (
                    <span className="mr-1.5 font-bold">{head.sub_item_label})</span>
                  )}
                  {head.sub_item_prompt || "..."}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {subOptions.map((opt) => {
                    const isSelected = subSelection.has(opt.answer_id);
                    return (
                      <span
                        key={opt.answer_id}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                          opt.is_correct
                            ? "bg-success-500/10 text-success-700 dark:text-success-400"
                            : isSelected
                              ? "bg-danger-500/10 text-danger-700 dark:text-danger-400"
                              : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {opt.content}
                        {opt.is_correct && " · đúng"}
                        {!opt.is_correct && isSelected && " · bạn chọn"}
                      </span>
                    );
                  })}
                </div>
                {!anySelected && (
                  <p className="mt-1 text-xs italic text-slate-400">Bỏ trống</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── FILL_IN_BLANK: đáp án text của thí sinh + đáp án đúng ─── */}
      {!isSubItemQuestion && question.question_type === "FILL_IN_BLANK" && (
        <div className="mt-3 space-y-1.5">
          <p className="text-sm">
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              Câu trả lời của bạn:{" "}
            </span>
            <span
              className={
                question.status === "correct"
                  ? "font-bold text-success-700 dark:text-success-400"
                  : "font-bold text-danger-700 dark:text-danger-400"
              }
            >
              {question.text_answer || "(bỏ trống)"}
            </span>
          </p>
          {question.status !== "correct" && (
            <p className="text-sm">
              <span className="font-semibold text-slate-500 dark:text-slate-400">
                Đáp án đúng:{" "}
              </span>
              <span className="font-bold text-success-700 dark:text-success-400">
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
      <div className="mt-3 grid gap-1.5">
        {question.options.map((opt) => {
          const isSelected = selectedIds.has(opt.answer_id);
          return (
            <div
              key={opt.answer_id}
              className={`flex items-start gap-2 rounded-xl px-3 py-1.5 text-sm ${
                opt.is_correct
                  ? "bg-success-500/10 font-semibold text-success-700 dark:text-success-400"
                  : isSelected
                    ? "bg-danger-500/10 text-danger-700 dark:text-danger-400"
                    : "text-slate-600 dark:text-slate-300"
              }`}
            >
              <span className="font-bold">{opt.label}.</span>
              <span className="line-clamp-1">{opt.content}</span>
              {opt.is_correct && (
                <span className="ml-auto shrink-0 text-xs font-bold">Đáp án đúng</span>
              )}
              {!opt.is_correct && isSelected && (
                <span className="ml-auto shrink-0 text-xs font-bold">Bạn chọn</span>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

