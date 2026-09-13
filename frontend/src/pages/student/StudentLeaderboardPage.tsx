import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import {
  ArrowLeft,
  Trophy,
  Medal,
  User,
  Star,
  Crown,
  ChevronDown,
  Loader2,
  Award,
  TrendingUp,
  Clock,
  Target,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HistoryItem {
  id: number;
  name: string;
  date: string;
  score: number | null;
  max_score: number;
  time_spent: number;
  status: string;
}

interface LeaderboardRecord {
  user_id: number;
  name: string;
  score: number;
  submit_time: string | null;
  rank: number;
}

interface LeaderboardData {
  status: string;
  top_10: LeaderboardRecord[];
  current_user_rank: number;
  total_participants_in_form: number;
}

export default function StudentLeaderboardPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<HistoryItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);

  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    api
      .get("/api/v1/exams/my-history")
      .then((res) => {
        const items: HistoryItem[] = res.data.items || [];
        const submitted = items.filter((h) => h.status === "SUBMITTED");
        setExams(submitted);
        if (submitted.length > 0) {
          setSelectedExamId(submitted[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      setIsLoadingLeaderboard(true);
      api
        .get(`/api/v1/exams/${selectedExamId}/leaderboard`)
        .then((res) => {
          setLeaderboard(res.data);
        })
        .catch(() => setLeaderboard(null))
        .finally(() => setIsLoadingLeaderboard(false));
    }
  }, [selectedExamId]);

  const selectedExam = exams.find((e) => e.id === selectedExamId);

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Crown className="w-5 h-5 text-white" />
          </div>
        );
      case 2:
        return (
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center shadow-lg shadow-slate-500/20">
            <Medal className="w-5 h-5 text-white" />
          </div>
        );
      case 3:
        return (
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-600/20">
            <Award className="w-5 h-5 text-white" />
          </div>
        );
      default:
        return (
          <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{rank}</span>
          </div>
        );
    }
  };

  const getCurrentUserRank = () => {
    if (!leaderboard || !leaderboard.current_user_rank) return null;
    const currentUser = leaderboard.top_10.find(
      (r) => r.rank === leaderboard.current_user_rank
    );
    return currentUser || null;
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Bảng xếp hạng
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nơi vinh danh những thí sinh xuất sắc nhất
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Exam Selector */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-4 sm:p-6 mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Chọn kỳ thi
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Xem bảng xếp hạng theo từng kỳ thi
                </p>
              </div>
            </div>

            <div className="relative flex-1 sm:max-w-md">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  {selectedExam ? selectedExam.name : "Chọn kỳ thi..."}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden"
                  >
                    <div className="max-h-64 overflow-y-auto">
                      {exams.map((exam) => (
                        <button
                          key={exam.id}
                          onClick={() => {
                            setSelectedExamId(exam.id);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors ${
                            selectedExamId === exam.id
                              ? "bg-amber-50 dark:bg-amber-900/20"
                              : ""
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                            <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                              {exam.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {exam.score !== null
                                ? `${exam.score}/${exam.max_score}`
                                : "Chưa chấm"}
                            </p>
                          </div>
                          {selectedExamId === exam.id && (
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Leaderboard Content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
        >
          {isLoadingLeaderboard ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-4" />
              <p className="text-sm text-slate-500 font-medium">Đang tải bảng xếp hạng...</p>
            </div>
          ) : !leaderboard ? (
            <div className="flex flex-col items-center gap-4 py-16 px-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 text-center">
                Không có dữ liệu xếp hạng
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md">
                Kỳ thi này chưa có đủ dữ liệu để hiển thị bảng xếp hạng. Vui lòng thử lại sau.
              </p>
            </div>
          ) : (
            <>
              {/* Stats Header */}
              <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: "Xếp hạng của bạn",
                      value: leaderboard.current_user_rank || "—",
                      icon: Trophy,
                      color: "from-amber-500 to-orange-600",
                    },
                    {
                      label: "Thí sinh tham gia",
                      value: leaderboard.total_participants_in_form,
                      icon: User,
                      color: "from-blue-500 to-indigo-600",
                    },
                    {
                      label: "Điểm cao nhất",
                      value:
                        leaderboard.top_10.length > 0 ? leaderboard.top_10[0].score : "—",
                      icon: TrendingUp,
                      color: "from-emerald-500 to-teal-600",
                    },
                    {
                      label: "Điểm TB top 10",
                      value:
                        leaderboard.top_10.length > 0
                          ? Math.round(
                              leaderboard.top_10.reduce((a, b) => a + b.score, 0) /
                                leaderboard.top_10.length
                            )
                          : "—",
                      icon: Star,
                      color: "from-purple-500 to-violet-600",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-md shrink-0`}
                      >
                        <stat.icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {stat.value}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          {stat.label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leaderboard List */}
              <div className="p-4 sm:p-6">
                <div className="space-y-2">
                  {leaderboard.top_10.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-slate-500">Chưa có dữ liệu xếp hạng</p>
                    </div>
                  ) : (
                    leaderboard.top_10.map((record, index) => (
                      <motion.div
                        key={record.user_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                          record.rank <= 3
                            ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200/50 dark:border-amber-800/30"
                            : "bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {getRankBadge(record.rank)}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {record.name}
                            </p>
                            {record.rank <= 3 && (
                              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                                Top {record.rank}
                              </span>
                            )}
                          </div>
                          {record.submit_time && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {new Date(record.submit_time).toLocaleString("vi-VN")}
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {record.score}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase">
                            điểm
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Current User Rank (if not in top 10) */}
              {getCurrentUserRank() && leaderboard.current_user_rank > 10 && (
                <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-primary-900/10 dark:to-indigo-900/10 border border-primary-200/50 dark:border-primary-800/30">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-md">
                      <span className="text-sm font-bold text-white">
                        {leaderboard.current_user_rank}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Vị trí của bạn
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Tiếp tục cố gắng để leo lên top!
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
                        {getCurrentUserRank()?.score}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase">
                        điểm
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
