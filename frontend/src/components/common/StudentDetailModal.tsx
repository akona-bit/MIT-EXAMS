import { useState, useEffect } from "react";
import { X, Loader2, Trophy, Calendar, Target, TrendingUp, BookOpenCheck } from "lucide-react";
import { Link } from "react-router-dom";
import type { StudentSearchResult } from "../../api/search";
import { getProfileSummary } from "../../api/studentProfile";
import VActProgressCard from "../../components/student-profile/VActProgressCard";
import VActRadarCard from "../../components/student-profile/VActRadarCard";
import ActivityHeatmapCard from "../../components/student-profile/ActivityHeatmapCard";
import KnowledgeNetworkCard from "../../components/student-profile/KnowledgeNetworkCard";
import { useAuth } from "../../stores/authStore";

interface StudentDetailModalProps {
  student: StudentSearchResult;
  onClose: () => void;
}

export default function StudentDetailModal({ student, onClose }: StudentDetailModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "progress" | "network">("overview");
  const { user } = useAuth();

  const canViewAnswers = user?.can_view_answers || user?.role?.name === "ADMIN" || user?.role?.name === "TEACHER";

  useEffect(() => {
    const loadSummary = async () => {
      try {
        await getProfileSummary(student.user_id);
      } catch (error) {
        console.error("Failed to load profile summary:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSummary();
  }, [student.user_id]);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      SUBMITTED: { label: "Da nop", color: "bg-blue-100 text-blue-700" },
      IN_PROGRESS: { label: "Dang thi", color: "bg-amber-100 text-amber-700" },
      NOT_STARTED: { label: "Chua bat dau", color: "bg-slate-100 text-slate-600" },
    };
    const info = statusMap[status] || { label: status, color: "bg-slate-100 text-slate-600" };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
        {info.label}
      </span>
    );
  };

  const bestScore = student.exams.reduce((best, exam) => {
    const score = exam.score || 0;
    return score > best ? score : best;
  }, 0);

  const totalExams = student.exams.length;
  const submittedExams = student.exams.filter(e => e.status === "SUBMITTED").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center shadow-lg">
                <span className="text-lg font-bold text-white">
                  {getInitials(student.full_name)}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {student.full_name || "Chua cap nhat"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  ID: {student.user_id}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "overview"
                  ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              Tong quan
            </button>
            <button
              onClick={() => setActiveTab("progress")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "progress"
                  ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              Tien do
            </button>
            <button
              onClick={() => setActiveTab("network")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "network"
                  ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              Kien thuc
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
          ) : (
            <>
              {activeTab === "overview" && (
                <div className="p-6 space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-xl p-4 border border-primary-200 dark:border-primary-700/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-500 rounded-lg">
                          <Trophy className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-primary-700 dark:text-primary-400">
                            {bestScore.toFixed(0)}
                          </p>
                          <p className="text-xs text-primary-600 dark:text-primary-500">Diem cao nhat</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500 rounded-lg">
                          <Target className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                            {submittedExams}/{totalExams}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-500">Da nop bai</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-700/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500 rounded-lg">
                          <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                            {student.exams.filter(e => e.rank && e.rank <= 3).length}
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-500">Top 3</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl p-4 border border-amber-200 dark:border-amber-700/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500 rounded-lg">
                          <Calendar className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                            {totalExams}
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-500">Ky thi tham gia</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Exam History */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                      Lich su thi
                    </h3>
                    {student.exams.length > 0 ? (
                      <div className="space-y-3">
                        {student.exams.map((exam, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 gap-4"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {exam.exam_name}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                {getStatusBadge(exam.status)}
                                {exam.exam_code && (
                                  <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono text-slate-600 dark:text-slate-300">
                                    {exam.exam_code}
                                  </span>
                                )}
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  Lan {exam.attempt_number}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 sm:ml-4 sm:border-l border-slate-200 dark:border-slate-700 sm:pl-4">
                              <div className="text-right">
                                {exam.score !== null ? (
                                  <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
                                    {exam.score.toFixed(0)}<span className="text-sm font-normal text-slate-500">/{exam.max_score}</span>
                                  </p>
                                ) : (
                                  <p className="text-sm text-slate-400">Chua co diem</p>
                                )}
                                {exam.rank && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                    #{exam.rank}
                                  </p>
                                )}
                              </div>
                              {canViewAnswers && exam.status === "SUBMITTED" && (
                                <Link
                                  to={`/student/exam/${exam.exam_id}/result?userId=${student.user_id}`}
                                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg shadow-md hover:from-emerald-600 hover:to-teal-700 transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 whitespace-nowrap"
                                >
                                  <BookOpenCheck className="w-4 h-4 mr-1.5" />
                                  Xem đáp án
                                </Link>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        Chua co lich su thi
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "progress" && (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 space-y-6">
                      <VActProgressCard studentId={student.user_id} />
                      <ActivityHeatmapCard studentId={student.user_id} />
                    </div>
                    <div className="lg:col-span-4">
                      <VActRadarCard studentId={student.user_id} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "network" && (
                <div className="p-6">
                  <KnowledgeNetworkCard studentId={student.user_id} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
