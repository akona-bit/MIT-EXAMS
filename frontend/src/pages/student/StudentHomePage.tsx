import { useEffect, useState } from "react";
import { useAuth } from "../../stores/authStore";
import { getExams } from "../../api/exams";
import client from "../../api/client";
import type { Exam } from "../../types";
import { motion } from "framer-motion";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
import Button from "../../components/ui/Button";

function formatExamWindow(startTime: string | null, endTime: string | null) {
  if (!startTime && !endTime) return "Thời gian linh hoạt";

  const formatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (startTime && endTime) {
    return `${formatter.format(new Date(startTime))} - ${formatter.format(new Date(endTime))}`;
  }

  return formatter.format(new Date(startTime || endTime || ""));
}

export default function StudentHomePage() {
  const { user, logout } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingExamId, setStartingExamId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const loadExams = async () => {
      try {
        const data = await getExams(0, 50, "PUBLISHED");
        setExams(data.items);
      } catch {
        setError("Không tải được danh sách kỳ thi. Vui lòng thử lại.");
      } finally {
        setIsLoading(false);
      }
    };

    loadExams();
  }, [retryKey]);

  const handleStart = async (exam: Exam) => {
    setStartingExamId(exam.id);
    setNotice("");
    try {
      const response = await client.post<{ form_code: string }>(
        `/api/v1/exams/${exam.id}/start`,
      );
      setNotice(
        `Đã nhận mã đề ${response.data.form_code}. Phòng thi đang được chuẩn bị.`,
      );
    } catch (requestError: unknown) {
      const detail =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError
          ? (requestError as { response?: { data?: { detail?: string } } })
              .response?.data?.detail
          : undefined;
      setNotice(detail || "Bạn chưa được đăng ký trong kỳ thi này.");
    } finally {
      setStartingExamId(null);
    }
  };

  const containerAnim = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="student-shell min-h-screen text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-50 glass-header border-b-transparent">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 text-lg font-bold text-white shadow-lg shadow-primary-500/25">
              M
            </div>
            <div>
              <p className="font-extrabold tracking-tight">MIT EXAMS</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Khu vực thí sinh</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-3 sm:flex rounded-full border border-slate-200/60 bg-white/60 dark:bg-slate-900/60 dark:border-slate-800/60 px-4 py-1.5 shadow-sm backdrop-blur-md">
              <div className="h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600 dark:text-primary-400">
                {user?.username?.[0]?.toUpperCase() || "S"}
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {user?.username || user?.email}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8 lg:py-10">
        <section className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-8">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
            Bảng điều khiển thí sinh
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Chào {user?.username || "bạn"}.
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300 max-w-xl">
            Các kỳ thi được mở cho bạn sẽ xuất hiện tại đây. Hãy kiểm tra thời
            lượng và thời gian trước khi bắt đầu. Chúc bạn thi tốt!
          </p>
        </section>

        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-2xl border border-primary-500/20 bg-primary-500/10 px-5 py-4 text-sm font-medium text-primary-600 dark:text-primary-400 shadow-sm backdrop-blur-md"
            role="status"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p>{notice}</p>
          </motion.div>
        )}

        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-primary-500">
                Kỳ thi của bạn
              </p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Sẵn sàng chinh phục
              </h2>
            </div>
            {!isLoading && (
              <span className="rounded-full bg-primary-50 dark:bg-primary-500/10 px-3 py-1 text-sm font-semibold text-primary-600 dark:text-primary-400">
                {exams.length} kỳ thi đang mở
              </span>
            )}
          </div>

          {isLoading && (
            <div className="rounded-3xl border border-slate-200/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 p-12 text-center backdrop-blur-xl">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              <p className="mt-4 text-sm font-medium text-slate-500">Đang tải kỳ thi...</p>
            </div>
          )}
          
          {error && (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-danger-500/20 bg-danger-500/10 p-12 text-center backdrop-blur-xl">
              <AlertCircle className="h-10 w-10 text-danger-500" />
              <p className="text-sm font-medium text-danger-600 dark:text-danger-400">{error}</p>
              <Button onClick={() => setRetryKey((key) => key + 1)} variant="destructive">
                Thử lại
              </Button>
            </div>
          )}
          
          {!isLoading && !error && exams.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 p-16 text-center backdrop-blur-xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <CheckCircle2 className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Chưa có kỳ thi đang mở
              </p>
              <p className="text-sm text-slate-500">
                Kỳ thi được phân công sẽ hiển thị ở đây.
              </p>
            </div>
          )}

          <motion.div 
            variants={containerAnim}
            initial="hidden"
            animate="show"
            className="grid gap-6 md:grid-cols-2"
          >
            {exams.map((exam) => (
              <motion.article
                variants={itemAnim}
                key={exam.id}
                className="group relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-6 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary-500/10"
              >
                <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-primary-500/5 transition-transform group-hover:scale-150" />
                
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-500/10 border border-success-500/20 px-3 py-1 text-xs font-bold text-success-600 dark:text-success-400">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-400 opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-success-500"></span>
                        </span>
                        Đang mở
                      </span>
                      <h3 className="mt-4 text-xl font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {exam.name}
                      </h3>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-3xl font-black text-primary-500 tracking-tighter">
                        {exam.duration_minutes}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        phút
                      </span>
                    </div>
                  </div>
                  
                  <p className="mb-6 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {exam.description || "Bài thi trắc nghiệm MIT EXAMS."}
                  </p>
                  
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                    <Clock className="h-4 w-4 text-primary-500 shrink-0" />
                    <span className="truncate">{formatExamWindow(exam.start_time, exam.end_time)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/10 pt-5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Mã #{exam.id}
                    </span>
                    <Button
                      onClick={() => handleStart(exam)}
                      disabled={startingExamId === exam.id}
                      size="lg"
                      className="shadow-lg shadow-primary-500/20"
                    >
                      {startingExamId === exam.id ? "Đang vào..." : "Bắt đầu thi"}
                    </Button>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </section>
      </main>
    </div>
  );
}
