import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../stores/authStore";
import api from "../../api/client";
import {
  ArrowLeft,
  User,
  Mail,
  Hash,
  Calendar,
  Trophy,
  BarChart3,
  Clock,
  Edit3,
  Save,
  X,
  Sparkles,
  Target,
} from "lucide-react";
import Button from "../../components/ui/Button";
import VActProgressCard from "../../components/student-profile/VActProgressCard";
import VActRadarCard from "../../components/student-profile/VActRadarCard";
import ActivityHeatmapCard from "../../components/student-profile/ActivityHeatmapCard";
import KnowledgeNetworkCard from "../../components/student-profile/KnowledgeNetworkCard";
import { motion } from "framer-motion";

interface HistoryItem {
  id: number;
  name: string;
  date: string;
  score: number | null;
  max_score: number;
  time_spent: number;
  status: string;
}

const containerAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export default function StudentDetailPage() {
  const navigate = useNavigate();
  const { user, fetchUser } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [avgScore, setAvgScore] = useState(0);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: user?.full_name || "",
    gender: user?.gender || "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setEditForm({
        full_name: user.full_name || "",
        gender: user.gender || "",
      });
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const res = await api.get("/api/v1/exams/my-history");
        if (!isMounted) return;
        const items = res.data.items || [];
        setHistory(items);
        const scored = items.filter((h: HistoryItem) => h.score !== null);
        if (scored.length > 0) {
          const total = scored.reduce(
            (sum: number, h: HistoryItem) => sum + (h.score || 0),
            0
          );
          setAvgScore(Math.round((total / scored.length) * 10) / 10);
        }
      } catch (err) {
        console.error("Failed to fetch history", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      await api.patch("/api/v1/users/me", {
        full_name: editForm.full_name,
        gender: editForm.gender === "" ? null : editForm.gender,
      });
      await fetchUser();
      setIsEditing(false);
    } catch (e) {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const getGenderLabel = (g: string | null | undefined) => {
    if (g === "nam") return "Nam";
    if (g === "nu") return "Nữ";
    return "Chưa cập nhật";
  };

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
          >
            <Button
              variant="ghost"
              className="text-white hover:bg-white/20 hover:text-white -ml-2 font-medium rounded-full px-4 mb-6"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Trở về
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-6"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-2xl">
              <User className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {user?.full_name || user?.username || "Thí sinh"}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-white/70">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4" /> {user?.email || "Chưa cập nhật email"}
                </span>
                <span className="flex items-center gap-1.5 font-mono">
                  <Hash className="w-4 h-4" /> SBD: {user?.username || "---"}
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4" /> {getGenderLabel(user?.gender)}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              {!isEditing ? (
                <Button
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/20 hover:text-white"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 className="w-4 h-4 mr-2" /> Sửa hồ sơ
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/20 hover:text-white"
                    onClick={() => setIsEditing(false)}
                  >
                    <X className="w-4 h-4 mr-2" /> Hủy
                  </Button>
                  <Button
                    className="bg-white text-primary-600 hover:bg-white/90"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      "Đang lưu..."
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" /> Lưu
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 pb-12 relative z-10">
        <motion.div variants={containerAnim} initial="hidden" animate="show">
          {/* Stats Row */}
          <motion.div variants={itemAnim} className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {[
              {
                label: "Điểm trung bình",
                value: avgScore || "—",
                icon: Target,
                gradient: "from-emerald-500 to-teal-600",
              },
              {
                label: "Bài thi đã làm",
                value: history.length,
                icon: BarChart3,
                gradient: "from-blue-500 to-indigo-600",
              },
              {
                label: "Điểm cao nhất",
                value:
                  history.filter((h) => h.score !== null).length > 0
                    ? Math.max(...history.filter((h) => h.score !== null).map((h) => h.score || 0))
                    : "—",
                icon: Trophy,
                gradient: "from-amber-500 to-orange-600",
              },
              {
                label: "Tổng thời gian",
                value: `${history.reduce((sum, h) => sum + (h.time_spent || 0), 0)} phút`,
                icon: Clock,
                gradient: "from-purple-500 to-violet-600",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform`}
                  >
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                      {stat.value}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Edit Form Inline */}
          {isEditing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-6"
            >
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
                Chỉnh sửa hồ sơ
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm"
                    placeholder="Nhập họ và tên"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">
                    Giới tính
                  </label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm"
                  >
                    <option value="">Không tiết lộ</option>
                    <option value="nam">Nam</option>
                    <option value="nu">Nữ</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}

          {/* V-ACT Profile Section */}
          {user?.id && (
            <motion.div variants={itemAnim} className="mb-8 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <VActProgressCard studentId={user.id} />
                  <ActivityHeatmapCard studentId={user.id} />
                </div>
                <div className="space-y-6">
                  <VActRadarCard studentId={user.id} />
                </div>
              </div>
              <KnowledgeNetworkCard studentId={user.id} />
            </motion.div>
          )}

          {/* History Section */}
          <motion.div variants={itemAnim}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Lịch sử làm bài
                </h2>
              </div>

              {isLoading ? (
                <div className="p-16 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-primary-600 mb-4"></div>
                  <p className="text-slate-500 font-medium text-sm">Đang tải lịch sử làm bài...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Clock className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    Chưa có lịch sử làm bài
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Bạn chưa hoàn thành bài thi nào.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="p-5 sm:p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-md shadow-primary-500/15 shrink-0">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                            {item.name}
                          </h3>
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500 font-medium">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" /> {formatDate(item.date)}
                            </span>
                            {item.time_spent > 0 && (
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> {item.time_spent} phút
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 sm:pl-6">
                        <div className="text-right">
                          <div className="text-xl font-bold text-primary-600 dark:text-primary-400">
                            {item.score !== null ? item.score : "--"}
                            <span className="text-xs text-slate-400 font-semibold ml-0.5">
                              /{item.max_score}
                            </span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                            Điểm số
                          </div>
                        </div>
                        {item.status === "SUBMITTED" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="shrink-0"
                            onClick={() => navigate(`/student/exam/${item.id}/result`)}
                          >
                            Chi tiết
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
