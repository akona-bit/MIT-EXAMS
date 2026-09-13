import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getExam, updateExamMode } from "../../api/exams";
import client from "../../api/client";
import type { Exam } from "../../types";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Users,
  Trophy,
  PlayCircle,
  XCircle,
  FileText,
  CheckCircle2,
  AlertCircle,
  Monitor,
  Printer,
} from "lucide-react";
import Button from "../../components/ui/Button";

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

interface MyExamInfo {
  id: number;
  status: string;
  score: number | null;
  max_score: number | null;
}

export default function StudentExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [myExam, setMyExam] = useState<MyExamInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingExamId, setStartingExamId] = useState<number | null>(null);
  const [selectedMode, setSelectedMode] = useState<"online" | "omr" | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    Promise.all([
      getExam(parseInt(id)),
      client.get<{ items: MyExamInfo[] }>("/api/v1/exams/my-history").then((res) => {
        const found = res.data.items?.find((e: MyExamInfo) => e.id === parseInt(id!));
        return found || null;
      }),
    ])
      .then(([examData, myExamData]) => {
        setExam(examData);
        setMyExam(myExamData);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || "Không thể tải thông tin kỳ thi");
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleStart = async (mode: "online" | "omr") => {
    if (!exam) return;
    setStartingExamId(exam.id);
    setSelectedMode(mode);
    try {
      await client.post<{ form_code: string }>(
        `/api/v1/exams/${exam.id}/start`
      );
      try {
        await updateExamMode(exam.id, mode === "omr" ? "PAPER" : "ONLINE");
      } catch {}
      navigate(`/student/exam/${exam.id}/session`, { state: { mode } });
    } catch (err: any) {
      alert(err.response?.data?.detail || "Không thể vào kỳ thi. Vui lòng thử lại.");
      setStartingExamId(null);
      setSelectedMode(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <p className="text-lg font-bold text-slate-900 dark:text-white">{error || "Không tìm thấy kỳ thi"}</p>
        <Button onClick={() => navigate("/student")}>Quay lại</Button>
      </div>
    );
  }

  const isScheduleOpen =
    (!exam.start_time || new Date(exam.start_time) <= new Date()) &&
    (!exam.end_time || new Date(exam.end_time) > new Date());

  const myAttempts = myExam ? 1 : 0;
  const isMaxReached = Boolean(
    exam.max_attempts &&
      myAttempts >= exam.max_attempts &&
      myExam?.status === "SUBMITTED"
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80 dark:from-[#060b14] dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate("/student")}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <h1 className="text-base font-bold text-slate-900 dark:text-white truncate">{exam.name}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Status Badge */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {isScheduleOpen ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Đang mở
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Chưa mở
            </span>
          )}
        </motion.div>

        {/* Exam Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-5"
        >
          {exam.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {exam.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Duration */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Thời gian</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {exam.duration_minutes ? `${exam.duration_minutes} phút` : "Không giới hạn"}
                </p>
              </div>
            </div>

            {/* Max Attempts */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Số lần thi</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {exam.max_attempts ? `Tối đa ${exam.max_attempts} lần` : "Không giới hạn"}
                </p>
              </div>
            </div>

            {/* Submission Count */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Thí sinh</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {exam.submission_count ?? 0} đã thi
                </p>
              </div>
            </div>

            {/* OMR */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Hình thức</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {exam.allow_omr ? "Trực tuyến & OMR" : "Trực tuyến"}
                </p>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm">
              <PlayCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">Mở cổng:</span>
              <span className="font-medium text-slate-900 dark:text-white">{formatDate(exam.start_time)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">Đóng cổng:</span>
              <span className="font-medium text-slate-900 dark:text-white">{formatDate(exam.end_time)}</span>
            </div>
          </div>
        </motion.div>

        {/* Previous Result */}
        {myExam && myExam.status === "SUBMITTED" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-emerald-50/80 dark:bg-emerald-900/20 backdrop-blur-sm rounded-2xl border border-emerald-200/80 dark:border-emerald-800/30 p-5"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Đã hoàn thành</p>
                {myExam.score !== null && (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    Điểm: {myExam.score}/{myExam.max_score}
                  </p>
                )}
              </div>
              <button
                onClick={() => navigate(`/student/exam/${exam.id}/result`)}
                className="ml-auto text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Xem kết quả →
              </button>
            </div>
          </motion.div>
        )}

        {/* Start Button */}
        {isScheduleOpen && !isMaxReached && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-3"
          >
            <Button
              onClick={() => handleStart("online")}
              disabled={startingExamId === exam.id}
              className="w-full h-12 text-base font-bold bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
            >
              {startingExamId === exam.id && selectedMode === "online" ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang vào thi...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  Bắt đầu thi trực tuyến
                </span>
              )}
            </Button>

            {exam.allow_omr && (
              <Button
                onClick={() => handleStart("omr")}
                disabled={startingExamId === exam.id}
                variant="outline"
                className="w-full h-12 text-base font-bold"
              >
                {startingExamId === exam.id && selectedMode === "omr" ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    Đang vào thi...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Printer className="w-5 h-5" />
                    Thi trên giấy (OMR)
                  </span>
                )}
              </Button>
            )}
          </motion.div>
        )}

        {isMaxReached && (
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            Bạn đã hết số lần thi cho phép.
          </div>
        )}
      </div>
    </div>
  );
}
