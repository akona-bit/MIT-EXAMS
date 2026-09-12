import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../stores/authStore";
import { getExams, updateExamMode } from "../../api/exams";
import client from "../../api/client";
import type { Exam } from "../../types";
import { motion } from "framer-motion";
import {
  AlertCircle,
  MessageSquare,
  FileText,
  ChevronRight,
  BookOpen,
  Play,
  CheckCircle2,
  Trophy,
  CalendarDays,
  ShieldAlert,
  Download,
  Printer,
} from "lucide-react";
import LoadingScreen from "../../components/ui/LoadingScreen";
import Button from "../../components/ui/Button";
import { getMaintenanceStatus, type MaintenanceStatus } from "../../api/system";
import MaintenanceScreen from "../../components/ui/MaintenanceScreen";
import { StudentFeedbackModal } from "../../components/student/StudentFeedbackModal";
import { PrintPreviewModal, AnswerSheetPreview } from "../../components/print";

/* ── helpers ── */
function formatExamWindow(startTime: string | null, endTime: string | null) {
  if (!startTime && !endTime) return "Thời gian linh hoạt";
  const fmt = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (startTime && endTime)
    return `${fmt.format(new Date(startTime))} – ${fmt.format(new Date(endTime))}`;
  return fmt.format(new Date(startTime || endTime || ""));
}

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

/* ── animation presets ── */
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 26 },
  },
};

/* ── Participant info from backend ── */
interface MyExamInfo {
  id: number;
  name: string;
  status: string; // NOT_STARTED | IN_PROGRESS | SUBMITTED | SUSPENDED
  date: string;
  score: number | null;
  max_score: number;
  time_spent: number;
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
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
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
      // Load published exams (available to take)
      const published = await getExams(0, 50, "PUBLISHED");
      setPublishedExams(published.items || []);

      // Load student's own exam history
      try {
        const res = await client.get<{ items: MyExamInfo[] }>("/api/v1/exams/my-history");
        setMyExams(res.data.items || []);
      } catch {
        // endpoint might not exist yet — graceful fallback
        setMyExams([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Không thể tải dữ liệu");
    } finally {
      setIsLoading(false);
    }
  };

  const [showWarningModal, setShowWarningModal] = useState<Exam | null>(null);
  const [examMode, setExamMode] = useState<'online' | 'omr'>('online');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const handleOpenWarning = (exam: Exam) => {
    setShowWarningModal(exam);
    setExamMode('online'); // default
  };

  const handleStart = async (exam: Exam, mode: 'online' | 'omr') => {
    setStartingExamId(exam.id);
    setNotice("");
    try {
      const response = await client.post<{ form_code: string }>(
        `/api/v1/exams/${exam.id}/start`
      );
      
      // Update exam mode via API
      try {
        await updateExamMode(exam.id, mode === 'omr' ? 'PAPER' : 'ONLINE');
      } catch (modeError) {
        console.error("Failed to update exam mode:", modeError);
        // Continue even if mode update fails
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

  if (maintenance?.maintenance_mode_all) return <MaintenanceScreen />;



  return (
    <>
      {/* Feedback FAB */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsFeedbackOpen(true)}
          className="flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-primary-600 shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-0.5 transition-all"
        >
          <MessageSquare className="w-4 h-4" />
          Góp ý
        </button>
      </div>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8 lg:py-10">
        {/* ══════ COMPACT STATS & ACTIONS ══════ */}
        {!isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-end"
          >
          <div className="flex items-center gap-3">
            <Link
              to="/student/leaderboard"
              className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-1.5 shadow-sm transition-colors group"
            >
              <Trophy className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                Bảng xếp hạng
              </span>
            </Link>

            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 shadow-sm">
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Đang mở: <span className="text-slate-900 dark:text-white">{publishedExams.length}</span>
              </span>
            </div>
            
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Đã thi: <span className="text-slate-900 dark:text-white">{submittedExams.length}</span>
              </span>
            </div>
          </div>
        </motion.div>
        )}

        {/* ══════ NOTICE ══════ */}
        {notice && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/50 dark:border-indigo-800 p-4"
          >
            <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <Play className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
              {notice}
            </p>
          </motion.div>
        )}

        {/* ══════ PUBLISHED EXAMS ══════ */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Kỳ thi đang mở
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bấm "Vào thi" để bắt đầu làm bài
                </p>
              </div>
            </div>
          </div>

          {isLoading && <LoadingScreen fullScreen={false} message="Đang tải..." />}

          {error && (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 p-12 text-center">
              <AlertCircle className="h-10 w-10 text-rose-500" />
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                Không thể tải kỳ thi
              </p>
              <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
              <Button
                onClick={() => setRetryKey((k) => k + 1)}
                variant="destructive"
              >
                Thử lại
              </Button>
            </div>
          )}

          {!isLoading && !error && publishedExams.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Chưa có kỳ thi nào đang mở
              </p>
              <p className="text-sm text-slate-500">
                Các kỳ thi mới sẽ xuất hiện tại đây khi được mở.
              </p>
            </div>
          )}

          {!isLoading && !error && publishedExams.length > 0 && (
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-3"
            >
            {publishedExams.map((exam) => (
              <motion.div
                variants={item}
                key={exam.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg hover:shadow-primary-500/5 transition-all"
              >
                <div className="flex items-start gap-4">
                  {exam.duration_minutes > 0 ? (
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex flex-col items-center justify-center text-primary-600 dark:text-primary-400">
                      <span className="text-lg font-black leading-none">
                        {exam.duration_minutes}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
                        phút
                      </span>
                    </div>
                  ) : (
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400">
                      <span className="text-[10px] font-bold uppercase text-center leading-tight">Không<br/>giới hạn</span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">
                        {exam.name}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        {formatExamWindow(exam.start_time, exam.end_time)}
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                        Mã #{exam.id}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleOpenWarning(exam)}
                  disabled={startingExamId === exam.id}
                  className="w-full sm:w-auto shrink-0 shadow-md shadow-primary-500/20"
                >
                  {startingExamId === exam.id ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" />
                      Đang vào…
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-1.5" />
                      Vào thi
                    </>
                  )}
                </Button>
              </motion.div>
            ))}
          </motion.div>
          )}
        </section>

        {/* ══════ COMPLETED EXAMS ══════ */}
        {!isLoading && submittedExams.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Kỳ thi đã hoàn thành
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Xem kết quả các kỳ thi đã nộp bài
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {submittedExams.map((e) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer hover:shadow-md"
                  onClick={() => navigate(`/student/exam/${e.id}/result`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                      {e.status === "SUSPENDED" ? (
                        <AlertCircle className="w-5 h-5 text-rose-500" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">
                        {e.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {e.status === "SUSPENDED"
                          ? "Bị đình chỉ"
                          : `Đã nộp · ${formatDate(e.date)}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    {user?.can_view_answers && e.score !== null && (
                      <div className="flex flex-col items-start sm:items-end">
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Điểm</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black text-emerald-600">{e.score}</span>
                          <span className="text-xs font-semibold text-slate-400">/{e.max_score}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-primary-600 text-sm font-semibold group-hover:underline">
                      Xem kết quả
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>

      <StudentFeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />

      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-100 dark:border-rose-800/30">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 flex items-center justify-center mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Lưu ý trước khi vào thi</h3>
            </div>
            <div className="p-6">
              {showWarningModal.allow_omr && (
                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                    Chọn hình thức làm bài:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div 
                      className={`border-2 rounded-xl p-4 cursor-pointer transition-colors ${examMode === 'online' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-primary-300'}`}
                      onClick={() => setExamMode('online')}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${examMode === 'online' ? 'border-primary-600' : 'border-slate-400'}`}>
                          {examMode === 'online' && <div className="w-2 h-2 bg-primary-600 rounded-full" />}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">Làm trên máy</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Chọn đáp án trực tiếp trên hệ thống.<br/>
                        <span className="font-semibold mt-1 inline-block">
                          {showWarningModal.duration_minutes ? `(Có tính giờ: ${showWarningModal.duration_minutes} phút)` : '(Không tính giờ - Chế độ luyện tập)'}
                        </span>
                      </p>
                    </div>
                    
                    <div 
                      className={`border-2 rounded-xl p-4 cursor-pointer transition-colors ${examMode === 'omr' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-primary-300'}`}
                      onClick={() => setExamMode('omr')}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${examMode === 'omr' ? 'border-primary-600' : 'border-slate-400'}`}>
                          {examMode === 'omr' && <div className="w-2 h-2 bg-primary-600 rounded-full" />}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">Làm trên giấy</span>
                      </div>
                      <p className="text-xs text-slate-500">Điền vào phiếu trả lời và chụp ảnh tải lên.</p>
                      {examMode === 'omr' && (
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
                            Xem phiếu trả lời
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
                  </div>
                  <p className="text-xs text-slate-500 mt-2 italic">
                    * Bạn chỉ được đổi hình thức thi 1 lần duy nhất.
                  </p>
                </div>
              )}

              <p className="text-slate-600 dark:text-slate-300 mb-4 leading-relaxed text-sm">
                Theo quy định của kỳ thi, bạn sẽ cần <strong>chứng thực học sinh</strong> bằng cách tải lên ảnh phù hiệu học sinh.
              </p>
              
              {examMode === 'online' && (
                <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 mb-6">
                  <p className="text-sm font-semibold text-rose-800 dark:text-rose-400">
                    ⚠️ CHÚ Ý: Trong quá trình làm bài trên máy, nếu bạn có ý định thoát tab hoặc chuyển sang cửa sổ khác, hệ thống sẽ ghi nhận vi phạm và bài làm đang làm có thể bị huỷ!
                  </p>
                </div>
              )}

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                  ⚠️ CẤM tải lên ảnh Căn cước công dân (CCCD) hoặc các giấy tờ có thông tin nhạy cảm khác. Nếu hệ thống phát hiện, bạn sẽ bị cảnh báo hoặc đình chỉ thi!
                </p>
              </div>
              <div className="flex gap-3 justify-end mt-8">
                <Button variant="outline" onClick={() => setShowWarningModal(null)}>Hủy</Button>
                <Button onClick={() => {
                  handleStart(showWarningModal, examMode);
                  setShowWarningModal(null);
                }}>
                  Đã hiểu, vào thi
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal for Answer Sheet */}
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
