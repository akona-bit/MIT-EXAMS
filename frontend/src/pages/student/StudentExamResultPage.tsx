import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
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
  Info,
  ArrowLeft,
  Target,
  BarChart3,
  Sparkles,
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
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export default function StudentExamResultPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userIdParam = searchParams.get("userId");

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
      const data = await getStudentExamResult(Number(examId), userIdParam ? Number(userIdParam) : undefined);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#060b14] dark:to-[#0a1128] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-800 text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/20 mb-6">
            {blockedWhileExam ? (
              <Clock className="h-8 w-8 text-amber-500" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            )}
          </div>
          <h1 className="text-xl font-bold mb-3 text-slate-800 dark:text-white">
            {blockedWhileExam ? "Bài thi chưa được nộp" : "Không xem được kết quả"}
          </h1>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 mb-8">{error}</p>
          <Link to="/student">
            <Button className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white">
              Quay lại trang chủ
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-[#060b14] dark:via-[#0a1128] dark:to-[#0f172a]">
      <ResultContent
        result={result}
        reviewFilter={reviewFilter}
        onFilterChange={setReviewFilter}
        onBack={() => navigate(-1)}
      />
    </div>
  );
}

function ResultContent({
  result,
  reviewFilter,
  onFilterChange,
  onBack,
}: {
  result: StudentExamResult;
  reviewFilter: ReviewFilter;
  onFilterChange: (f: ReviewFilter) => void;
  onBack: () => void;
}) {
  const { raw_scores, true_score, can_view_answers } = result;

  // Nếu thí sinh chưa có quyền xem điểm
  if (!can_view_answers) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl shadow-indigo-500/10 border border-slate-200 dark:border-slate-800 text-center"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 mb-6">
            <CheckCircle2 className="h-10 w-10 text-white" />
          </div>
          
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Nộp bài thành công!
          </h1>
          
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 my-6 border border-slate-100 dark:border-slate-800 text-left">
            <div className="flex gap-3 text-slate-600 dark:text-slate-300 text-sm mb-2">
              <span className="font-semibold w-24 shrink-0">Kỳ thi:</span>
              <span>{result.exam_name}</span>
            </div>
            <div className="flex gap-3 text-slate-600 dark:text-slate-300 text-sm">
              <span className="font-semibold w-24 shrink-0">Trạng thái:</span>
              <span className={result.is_suspended ? "text-rose-600 font-semibold" : "text-emerald-600 font-semibold"}>
                {result.is_suspended ? "Bị đình chỉ" : "Đã nộp bài"}
              </span>
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl p-5 mb-8 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Lock className="w-16 h-16 text-indigo-900 dark:text-indigo-300" />
            </div>
            <div className="flex items-start gap-3 relative z-10">
              <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-indigo-900 dark:text-indigo-300 text-sm mb-1">Chờ kết quả & đáp án</h3>
                <p className="text-indigo-800 dark:text-indigo-400 text-sm leading-relaxed">
                  Hệ thống đang lưu trữ bài làm của bạn. Điểm thi chi tiết và đáp án sẽ được cập nhật sau.
                </p>
                <p className="text-indigo-600 dark:text-indigo-500 text-xs mt-3 font-medium bg-indigo-100/50 dark:bg-indigo-800/30 inline-block px-2 py-1 rounded">
                  * Dành riêng cho thí sinh đã thanh toán lệ phí thi.
                </p>
              </div>
            </div>
          </div>

          <Button onClick={onBack} className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white shadow-xl shadow-primary-500/20">
            Quay lại trang chủ
          </Button>
        </motion.div>
      </div>
    );
  }

  // --- Nếu CÓ quyền xem điểm ---
  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2Mmgxem0tNC04di0ySDI0djJoMnptOC04VjhoLTJ2Mmg4em0tNC00VjRoLTJ2Mmg0eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-white/20 hover:text-white -ml-2 font-medium rounded-full px-4" 
                onClick={onBack}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Trở về
              </Button>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl">
                <BookOpenCheck className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Kết quả bài thi
                </h1>
                <p className="text-white/70 mt-1">
                  {result.exam_name || `Kỳ thi #${result.exam_id}`}
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {result.is_suspended ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/30 bg-rose-500/20 px-3 py-1 text-xs font-bold text-white">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Phiên thi bị đình chỉ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-white">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Đã nộp bài
                </span>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 pb-12 relative z-20">
        <motion.div variants={containerAnim} initial="hidden" animate="show">
          {/* Stats Cards */}
          <motion.div variants={itemAnim} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatNumber(raw_scores.total)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Điểm thô</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {raw_scores.answered_count}/{raw_scores.total_questions}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Trả lời</p>
                </div>
              </div>
            </div>
            
            {true_score.available && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatNumber(true_score.irt_total ?? 0)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Điểm thực</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {raw_scores.method}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Phương pháp</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Points by Part */}
          <motion.div variants={itemAnim} className="mb-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                  <BookOpenCheck className="h-5 w-5 text-primary-500" />
                  Điểm theo phần thi
                </h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {raw_scores.parts.map((part) => (
                    <div
                      key={part.part}
                      className="relative p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Phần {part.part}
                        </p>
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                          {part.label}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(part.raw_score)}
                        </span>
                        <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                          /{part.max_raw_score}
                        </span>
                      </div>
                      {true_score.available && part.irt_score !== null && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-primary-500" />
                          <p className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                            IRT: {formatNumber(part.irt_score)}/300
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* True Score Section */}
          <TrueScoreSection trueScore={true_score} />

          {/* Review Section */}
          <motion.div variants={itemAnim}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                  <ListChecks className="h-5 w-5 text-primary-500" />
                  Xem lại bài làm
                </h2>
              </div>
              <div className="p-4 sm:p-6">
                {!result.review ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-5">
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
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
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
      className="mb-6"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <Trophy className="h-5 w-5 text-amber-500" />
            Điểm thực (quy đổi 0–1200)
          </h2>
        </div>
        <div className="p-4 sm:p-6">
          {trueScore.available ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white">
                    {formatNumber(trueScore.irt_total ?? 0)}
                  </span>
                  <span className="text-lg font-medium text-slate-400 dark:text-slate-500">/ 1200</span>
                </div>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Điểm chính thức theo IRT
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4 border border-amber-200 dark:border-amber-800/50">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {trueScore.state === "computing"
                    ? "Đang chờ tính toán"
                    : trueScore.state === "not_enough_data"
                      ? "Kỳ thi chưa đủ dữ liệu"
                      : "Chưa có điểm thực"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {trueScore.message}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const STATUS_STYLES: Record<ReviewQuestion["status"], { ring: string; badge: string; label: string; icon: any }> = {
  correct: {
    ring: "border-emerald-500/40",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    label: "Đúng",
    icon: CheckCircle2,
  },
  wrong: {
    ring: "border-rose-500/40",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    label: "Sai",
    icon: XCircle,
  },
  penalized: {
    ring: "border-rose-500/40",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    label: "Trừ điểm",
    icon: XCircle,
  },
  skipped: {
    ring: "border-slate-200 dark:border-slate-700",
    badge: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
    label: "Bỏ trống",
    icon: EyeOff,
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

  const filters: { key: ReviewFilter; label: string; count?: number; color: string }[] = [
    { key: "all", label: "Tất cả", color: "bg-slate-900 dark:bg-white text-white dark:text-slate-900" },
    { key: "wrong", label: "Sai", count: wrongCount, color: "bg-rose-500 text-white" },
    { key: "skipped", label: "Bỏ trống", count: skippedCount, color: "bg-slate-500 text-white" },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onFilterChange(f.key)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              filter === f.key
                ? `${f.color} shadow-md`
                : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            {f.label}
            {f.count !== undefined && (
              <span className={`rounded-full px-1.5 text-xs ${
                filter === f.key ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'
              }`}>
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
          <div className="text-center py-8">
            <p className="text-slate-500 dark:text-slate-400">Không có câu nào trong mục này.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionReviewCard({ question }: { question: ReviewQuestion }) {
  const style = STATUS_STYLES[question.status];
  const selectedIds = new Set(question.selected_answer_ids);
  const subAnswers = question.selected_subitem_answers || {};
  const StatusIcon = style.icon;

  const isSubItemQuestion =
    (question.question_type === "TRUE_FALSE" ||
      question.question_type === "COMPOSITE") &&
    question.options.some((opt) => opt.sub_item_id != null);

  const getSubSelection = (subItemId: number): number[] => {
    const v = subAnswers[String(subItemId)] ?? (subAnswers as any)[subItemId];
    if (v == null) return [];
    return Array.isArray(v) ? v.map(Number) : [Number(v)];
  };

  return (
    <div
      className={`rounded-xl border bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 ${style.ring}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Câu {question.position}
          </span>
          <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {question.part_label}
          </span>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${style.badge}`}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {style.label}
        </span>
      </div>

      {isSubItemQuestion ? (
        <div className="space-y-3">
          {question.options
            .filter((opt) => opt.sub_item_id != null)
            .reduce(
              (acc, opt) => {
                if (!acc.find((a) => a.sub_item_id === opt.sub_item_id)) {
                  acc.push(opt);
                }
                return acc;
              },
              [] as typeof question.options,
            )
            .map((subOpt) => {
              const subSelection = getSubSelection(subOpt.sub_item_id!);
              return (
                <div key={subOpt.sub_item_id} className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    Ý con {subOpt.sub_item_id}
                  </p>
                  <div className="space-y-1.5">
                    {question.options
                      .filter((o) => o.sub_item_id === subOpt.sub_item_id)
                      .map((opt) => {
                        const isSelected = subSelection.includes(opt.answer_id);
                        const isCorrect = opt.is_correct;
                        return (
                          <div
                            key={opt.answer_id}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                              isCorrect
                                ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 font-semibold"
                                : isSelected
                                  ? "bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400 line-through"
                                  : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            <span className="font-mono text-xs">{opt.label}.</span>
                            <span className="flex-1">{opt.content}</span>
                            {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                            {isSelected && !isCorrect && <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {question.options.map((opt) => {
            const isSelected = selectedIds.has(opt.answer_id);
            const isCorrect = opt.is_correct;
            return (
              <div
                key={opt.answer_id}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  isCorrect
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 font-semibold"
                    : isSelected
                      ? "bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400 line-through"
                      : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <span className="font-mono text-xs">{opt.label}.</span>
                <span className="flex-1">{opt.content}</span>
                {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                {isSelected && !isCorrect && <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}