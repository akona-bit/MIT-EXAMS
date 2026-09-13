import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../stores/authStore";
import { getExams, updateExamMode } from "../../api/exams";
import client from "../../api/client";
import type { Exam } from "../../types";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  FileText,
  BookOpen,
  Play,
  CheckCircle2,
  Trophy,
  CalendarDays,
  CalendarClock,
  ShieldAlert,
  Download,
  Printer,
  Clock,
  Target,
  TrendingUp,
  User,
  Users,
  ArrowRight,
  Zap,
  Monitor,
  PlayCircle,
  XCircle,
} from "lucide-react";
import LoadingScreen from "../../components/ui/LoadingScreen";
import Button from "../../components/ui/Button";
import { getMaintenanceStatus, type MaintenanceStatus } from "../../api/system";
import MaintenanceScreen from "../../components/ui/MaintenanceScreen";
import { PrintPreviewModal, AnswerSheetPreview } from "../../components/print";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 22 },
  },
};

interface MyExamInfo {
  id: number;
  name: string;
  status: string;
  date: string;
  score: number | null;
  max_score: number;
  time_spent: number;
  max_attempts?: number | null;
  attempt_number?: number;
}

export default function StudentHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [publishedExams, setPublishedExams] = useState<Exam[]>([]);
  const [myExams, setMyExams] = useState<MyExamInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingExamId, setStartingExamId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [maintenance, setMaintenance] = useState<MaintenanceStatus | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const status = await getMaintenanceStatus();
        setMaintenance(status);
        if (status.maintenance_mode_all) {
          setIsLoading(false);
          return;
        }
      } catch {
        /* fallback */
      }
      await loadData();
    };
    init();
  }, [retryKey]);

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const published = await getExams(0, 50, "PUBLISHED");
      setPublishedExams(published.items || []);

      try {
        const res = await client.get<{ items: MyExamInfo[] }>("/api/v1/exams/my-history");
        setMyExams(res.data.items || []);
      } catch {
        setMyExams([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Không thể tải dữ liệu");
    } finally {
      setIsLoading(false);
    }
  };

  const [showWarningModal, setShowWarningModal] = useState<Exam | null>(null);
  const [examMode, setExamMode] = useState<"online" | "omr">("online");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const handleOpenWarning = (exam: Exam) => {
    setShowWarningModal(exam);
    setExamMode("online");
  };

  const handleStart = async (exam: Exam, mode: "online" | "omr") => {
    setStartingExamId(exam.id);
    setNotice("");
    try {
      const response = await client.post<{ form_code: string }>(
        `/api/v1/exams/${exam.id}/start`
      );

      try {
        await updateExamMode(exam.id, mode === "omr" ? "PAPER" : "ONLINE");
      } catch (modeError) {
        console.error("Failed to update exam mode:", modeError);
      }

      setNotice(
        `Đã nhận mã đề ${response.data.form_code}. Đang chuyển vào phòng thi…`
      );
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      startTimerRef.current = setTimeout(() => {
        navigate(`/student/exam/${exam.id}/session`, { state: { mode } });
      }, 1200);
    } catch (requestError: unknown) {
      const detail =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError
          ? (requestError as { response?: { data?: { detail?: string } } })
              .response?.data?.detail
          : undefined;
      setNotice(detail || "Không thể vào kỳ thi này. Vui lòng thử lại.");
    } finally {
      setStartingExamId(null);
    }
  };

  const submittedExams = myExams.filter(
    (e) => e.status === "SUBMITTED" || e.status === "SUSPENDED"
  );

  // Classify published exams into upcoming vs open
  const now = new Date();
  const upcomingExams = publishedExams.filter((exam) => {
    if (exam.start_time && new Date(exam.start_time) > now) return true;
    return false;
  });
  const openExams = publishedExams.filter((exam) => {
    if (exam.start_time && new Date(exam.start_time) > now) return false;
    if (exam.end_time && new Date(exam.end_time) <= now) return false;
    return true;
  });

  const avgScore =
    submittedExams.filter((e) => e.score !== null).length > 0
      ? Math.round(
          (submittedExams.reduce((acc, e) => acc + (e.score || 0), 0) /
            submittedExams.filter((e) => e.score !== null).length) *
            10
        ) / 10
      : null;

  const highScore =
    submittedExams.length > 0
      ? Math.max(...submittedExams.map((e) => e.score || 0))
      : null;

  if (maintenance?.maintenance_mode_all) return <MaintenanceScreen />;

  return (
    <>
      <div className="min-h-screen relative">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50/80 dark:from-[#060b14] dark:via-slate-900 dark:to-slate-950 -z-10" />

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 relative z-10">
          {/* Notice Banner */}
          <AnimatePresence>
            {notice && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="mb-6"
              >
                <div className="flex items-center gap-3 rounded-2xl border border-indigo-200/80 bg-white/80 dark:bg-slate-900/80 dark:border-indigo-800/50 p-4 shadow-lg shadow-indigo-500/10 backdrop-blur-sm">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Play className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">
                    {notice}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats Cards */}
          {!isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8"
            >
              {[
                {
                  label: "Đang mở",
                  value: openExams.length,
                  icon: BookOpen,
                  color: "blue",
                  gradient: "from-blue-500 to-blue-600",
                },
                {
                  label: "Đã thi",
                  value: submittedExams.length,
                  icon: CheckCircle2,
                  color: "emerald",
                  gradient: "from-emerald-500 to-teal-600",
                },
                {
                  label: "Điểm TB",
                  value: avgScore !== null ? avgScore : "—",
                  icon: Target,
                  color: "amber",
                  gradient: "from-amber-500 to-orange-600",
                },
                {
                  label: "Cao nhất",
                  value: highScore !== null ? highScore : "—",
                  icon: TrendingUp,
                  color: "purple",
                  gradient: "from-purple-500 to-violet-600",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg shadow-${stat.color}-500/20 group-hover:scale-105 transition-transform`}
                    >
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {stat.value}
                      </p>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center py-16">
              <LoadingScreen fullScreen={false} message="Đang tải..." />
            </div>
          )}

          {/* Error State */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 rounded-3xl border border-rose-200 dark:border-rose-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-12 text-center shadow-lg"
            >
              <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-rose-500" />
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                Không thể tải kỳ thi
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{error}</p>
              <Button onClick={() => setRetryKey((k) => k + 1)} variant="destructive">
                Thử lại
              </Button>
            </motion.div>
          )}

          {/* Empty State */}
          {!isLoading && !error && publishedExams.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm p-12 sm:p-16 text-center"
            >
              <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <FileText className="h-10 w-10 text-slate-400" />
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                Chưa có kỳ thi nào đang mở
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                Các kỳ thi mới sẽ xuất hiện tại đây khi được mở. Bạn sẽ nhận được thông báo khi có
                kỳ thi mới.
              </p>
            </motion.div>
          )}

          {/* Upcoming Exams — sắp mở */}
          {!isLoading && !error && upcomingExams.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <CalendarClock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Kỳ thi sắp mở
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kỳ thi sẽ tự động mở khi đến giờ
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-amber-200/60 dark:border-amber-800/30 p-5 sm:p-6"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex flex-col items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                        {exam.duration_minutes != null && exam.duration_minutes > 0 ? (
                          <>
                            <span className="text-lg font-bold text-white leading-none">
                              {exam.duration_minutes}
                            </span>
                            <span className="text-[8px] font-semibold text-white/80 uppercase">
                              phút
                            </span>
                          </>
                        ) : (
                          <Clock className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 dark:text-white truncate">
                          {exam.name}
                        </h3>
                        {exam.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {exam.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      {exam.start_time && (
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                          <PlayCircle className="w-4 h-4 shrink-0" />
                          <span>Mở: {formatDate(exam.start_time)}</span>
                        </div>
                      )}
                      {exam.end_time && (
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                          <XCircle className="w-4 h-4 shrink-0" />
                          <span>Đóng: {formatDate(exam.end_time)}</span>
                        </div>
                      )}
                      {exam.submission_count != null && exam.submission_count > 0 && (
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <Users className="w-4 h-4 shrink-0" />
                          <span>{exam.submission_count} thí sinh đã thi</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Open Exams — đang mở */}
          {!isLoading && !error && openExams.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Kỳ thi đang mở
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Chọn kỳ thi để bắt đầu làm bài
                  </p>
                </div>
              </div>

              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {openExams.map((exam) => {
                  const myAttempts = myExams.filter((m) => m.id === exam.id);
                  const latestAttempt = myAttempts.length > 0 ? myAttempts[0] : null;
                  const isMaxReached = Boolean(
                    exam.max_attempts &&
                      myAttempts.length >= exam.max_attempts &&
                      latestAttempt?.status === "SUBMITTED"
                  );

                  return (
                    <motion.div
                      variants={item}
                      key={exam.id}
                      className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-300"
                    >
                      {/* Card Header */}
                      <div className="relative p-5 sm:p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex flex-col items-center justify-center shadow-lg shadow-primary-500/20">
                              {exam.duration_minutes != null && exam.duration_minutes > 0 ? (
                                <>
                                  <span className="text-lg font-bold text-white leading-none">
                                    {exam.duration_minutes}
                                  </span>
                                  <span className="text-[8px] font-semibold text-white/80 uppercase">
                                    phút
                                  </span>
                                </>
                              ) : (
                                <Clock className="w-5 h-5 text-white" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                </span>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                                  {exam.name}
                                </h3>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Exam Info */}
                        <div className="space-y-2 mb-5">
                          {exam.start_time && (
                            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                              <PlayCircle className="w-4 h-4 shrink-0" />
                              <span>Mở: {formatDate(exam.start_time)}</span>
                            </div>
                          )}
                          {exam.end_time && (
                            <div className="flex items-center gap-2 text-sm text-rose-500 dark:text-rose-400">
                              <XCircle className="w-4 h-4 shrink-0" />
                              <span>Đóng: {formatDate(exam.end_time)}</span>
                            </div>
                          )}
                          {!exam.start_time && !exam.end_time && (
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                              <CalendarDays className="w-4 h-4 shrink-0" />
                              <span>Thời gian linh hoạt</span>
                            </div>
                          )}
                          {exam.submission_count != null && exam.submission_count > 0 && (
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                              <Users className="w-4 h-4 shrink-0" />
                              <span>{exam.submission_count} thí sinh đã thi</span>
                            </div>
                          )}
                          {exam.max_attempts && (
                            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                              <Trophy className="w-4 h-4" />
                              <span>Giới hạn {exam.max_attempts} lần thi</span>
                            </div>
                          )}
                        </div>

                        {/* Attempt Info */}
                        {latestAttempt && latestAttempt.status === "SUBMITTED" && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 mb-4">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                              Đã thi {myAttempts.length} lần
                            </span>
                            {latestAttempt.score !== null && (
                              <span className="ml-auto text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                {latestAttempt.score}/{latestAttempt.max_score}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Footer */}
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-2">
                        <Button
                          onClick={() => handleOpenWarning(exam)}
                          disabled={startingExamId === exam.id || isMaxReached}
                          className={`w-full ${
                            isMaxReached
                              ? "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                              : "bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
                          }`}
                        >
                          {startingExamId === exam.id ? (
                            <>
                              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" />
                              Đang vào…
                            </>
                          ) : isMaxReached ? (
                            <>Hết lượt thi</>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Vào thi ngay
                            </>
                          )}
                        </Button>
                        <button
                          onClick={() => navigate(`/student/exam/${exam.id}`)}
                          className="w-full text-center text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline py-1"
                        >
                          Xem chi tiết
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </section>
          )}

          {/* Completed Exams */}
          {!isLoading && submittedExams.length > 0 && (
            <section className="mt-12">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      Kỳ thi đã hoàn thành
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Xem kết quả các kỳ thi đã nộp bài
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {submittedExams.map((e, index) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-300 cursor-pointer"
                    onClick={() => navigate(`/student/exam/${e.id}/result`)}
                  >
                    <div className="p-5 sm:p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              e.status === "SUSPENDED"
                                ? "bg-rose-50 dark:bg-rose-900/20"
                                : "bg-emerald-50 dark:bg-emerald-900/20"
                            }`}
                          >
                            {e.status === "SUSPENDED" ? (
                              <AlertCircle className="w-6 h-6 text-rose-500" />
                            ) : (
                              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                              {e.name}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {e.status === "SUSPENDED"
                                ? "Bị đình chỉ"
                                : `Lần thi ${e.attempt_number || 1}`}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(e.date)}
                        </div>

                        {user?.can_view_answers && e.score !== null && (
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                              {e.score}
                            </span>
                            <span className="text-sm font-medium text-slate-400">/{e.max_score}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                      <div className="flex items-center justify-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400 group-hover:underline">
                        Xem kết quả
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Warning Modal */}
      <AnimatePresence>
        {showWarningModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2Mmgxem0tNC04di0ySDI0djJoMnptOC04VjhoLTJ2Mmg4em0tNC00VjRoLTJ2Mmg0eiIvPjwvZz48L2c+PC9zdmc+')] opacity-20" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <ShieldAlert className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Lưu ý trước khi vào thi</h3>
                    <p className="text-white/80 text-sm mt-0.5">Vui lòng đọc kỹ các quy định</p>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {showWarningModal.allow_omr && (
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                      Chọn hình thức làm bài:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        {
                          mode: "online" as const,
                          label: "Làm trên máy",
                          desc: "Chọn đáp án trực tiếp trên hệ thống.",
                          icon: Monitor,
                        },
                        {
                          mode: "omr" as const,
                          label: "Làm trên giấy",
                          desc: "Điền vào phiếu trả lời và chụp ảnh tải lên.",
                          icon: FileText,
                        },
                      ].map((opt) => (
                        <div
                          key={opt.mode}
                          className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                            examMode === opt.mode
                              ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg shadow-primary-500/10"
                              : "border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700"
                          }`}
                          onClick={() => setExamMode(opt.mode)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                examMode === opt.mode ? "border-primary-600" : "border-slate-400"
                              }`}
                            >
                              {examMode === opt.mode && (
                                <div className="w-2 h-2 bg-primary-600 rounded-full" />
                              )}
                            </div>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {opt.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{opt.desc}</p>
                          <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mt-2">
                            {showWarningModal.duration_minutes
                              ? `${showWarningModal.duration_minutes} phút`
                              : "Không tính giờ"}
                          </p>
                          {opt.mode === "omr" && examMode === "omr" && (
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsPrintModalOpen(true);
                                }}
                                className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-lg border border-blue-200 transition-colors"
                              >
                                <Printer className="w-3 h-3" />
                                Xem phiếu
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsPrintModalOpen(true);
                                }}
                                className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2 py-1 rounded-lg border border-green-200 transition-colors"
                              >
                                <Download className="w-3 h-3" />
                                Tải PDF
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
                      * Bạn chỉ được đổi hình thức thi 1 lần duy nhất.
                    </p>
                  </div>
                )}

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                    <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      <strong>CẤM</strong> tải lên ảnh CCCD hoặc các giấy tờ có thông tin nhạy cảm.
                      Hệ thống sẽ cảnh báo hoặc đình chỉ thi nếu phát hiện.
                    </p>
                  </div>

                  {examMode === "online" && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50">
                      <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-rose-800 dark:text-rose-300">
                        <strong>CHÚ Ý:</strong> Khi làm bài trên máy, nếu thoát tab hoặc chuyển cửa
                        sổ khác, hệ thống sẽ ghi nhận vi phạm và bài làm có thể bị huỷ!
                      </p>
                    </div>
                  )}

                  <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
                    <User className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      Bạn sẽ cần <strong>chứng thực học sinh</strong> bằng cách tải lên ảnh phù hiệu
                      học sinh khi vào thi.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowWarningModal(null)}
                    className="sm:w-auto w-full"
                  >
                    Hủy
                  </Button>
                  <Button
                    onClick={() => {
                      handleStart(showWarningModal, examMode);
                      setShowWarningModal(null);
                    }}
                    className="sm:w-auto w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Đã hiểu, vào thi
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PrintPreviewModal
        open={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="Phiếu trả lời trắc nghiệm"
      >
        <AnswerSheetPreview
          schoolName={showWarningModal?.name}
          examTitle={showWarningModal?.name}
        />
      </PrintPreviewModal>
    </>
  );
}
