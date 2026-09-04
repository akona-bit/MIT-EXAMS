import { useState, useEffect } from "react";
import { Search, Target, TrendingUp, AlertTriangle, User } from "lucide-react";
import {
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { Button } from "../../../components/ui/Button";
import { toast } from '../../../components/ui/Toast';
import { Card } from "../../../components/ui/Card";
import { Skeleton } from "../../../components/ui/Skeleton";
import CelebrationOverlay from "./CelebrationOverlay";
import { motion } from "framer-motion";
import { useTheme } from "../../../stores/themeStore";
import client from "../../../api/client";

export default function StudentAnalyticsPage() {
  const [search, setSearch] = useState("");
  const [student, setStudent] = useState<any>(null);
  const [responses, setResponses] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [classSummary, setClassSummary] = useState<any>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    fetchClassSummary();
  }, []);

  const fetchClassSummary = async () => {
    try {
      const res = await client.get(
        "/api/v1/analytics/class-summary",
      );
      const data = res.data;
      setClassSummary(data);
    } catch (e) {
      console.error("Failed to fetch class summary");
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search) return;

    setIsLoading(true);
    setStudent(null);
    setResponses(null);

    try {
      const res1 = await client.get(
        `/api/v1/analytics/students?search=${encodeURIComponent(search)}`,
      );
      const data1 = res1.data;

      let resData = null;
      try {
        const res2 = await client.get(
          `/api/v1/analytics/responses/${encodeURIComponent(search)}`,
        );
        if (res2.status === 200) {
          resData = res2.data;
        }
      } catch (err) {}

      if (data1.items && data1.items.length > 0) {
        setStudent(data1.items[0]);
      } else {
        toast.warning("Không tìm thấy học sinh!");
      }
      if (resData) {
        setResponses(resData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getKnowledgeMatrix = () => {
    if (!responses || !responses.responses) return null;
    const questions = Object.keys(responses.responses).map((q) => {
      const num = parseInt(q.replace("Câu ", ""));
      return { num, q, status: responses.responses[q] };
    });

    return (
      <div className="grid grid-cols-10 sm:grid-cols-15 gap-2 sm:gap-3 mt-6">
        {questions.map((q) => {
          let bg =
            "bg-slate-100 dark:bg-slate-800 text-slate-500 shadow-inner border border-slate-200/50 dark:border-slate-700";
          if (q.status === "correct")
            bg =
              "bg-success-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] border border-success-400";
          else if (q.status === "wrong")
            bg =
              "bg-danger-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] border border-danger-400";

          return (
            <motion.div
              whileHover={{ scale: 1.15, y: -2 }}
              key={q.q}
              className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl text-sm font-extrabold transition-all cursor-default ${bg}`}
              title={`${q.q}: ${q.status}`}
            >
              {q.num}
            </motion.div>
          );
        })}
      </div>
    );
  };

  const getRadarData = () => {
    if (!student || !classSummary) return [];
    return [
      {
        subject: "Toán (IRT)",
        "Điểm của bạn": student.irt_toan || 0,
        "Trung bình lớp": classSummary.avg_toan || 0,
        fullMark: 300,
      },
      {
        subject: "TDKH (IRT)",
        "Điểm của bạn": student.irt_tdkh || 0,
        "Trung bình lớp": classSummary.avg_tdkh || 0,
        fullMark: 300,
      },
      {
        subject: "Toán (Thô)",
        "Điểm của bạn": (student.tho_toan || 0) * 10,
        "Trung bình lớp": 150,
        fullMark: 300,
      },
      {
        subject: "TDKH (Thô)",
        "Điểm của bạn": (student.tho_tdkh || 0) * 10,
        "Trung bình lớp": 150,
        fullMark: 300,
      },
    ];
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 },
    },
  };

  return (
    <div className="space-y-8">
      <CelebrationOverlay
        studentName={student?.name}
        valedictorianName={classSummary?.valedictorian?.name}
        salutatorianName={classSummary?.salutatorian?.name}
      />

      <div className="border-b border-slate-200/60 dark:border-slate-800/60 pb-6">
        <h1 className="text-3xl font-extrabold text-gradient pb-1 tracking-tight">
          Tra Cứu Điểm Cá Nhân
        </h1>
        <p className="text-base font-medium text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
          Phân tích năng lực chuyên sâu, xác định lỗ hổng kiến thức qua bản đồ
          điểm số chuẩn hóa.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="p-2 sm:p-4 glass-card border border-white/50 dark:border-white/10 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 via-purple-50/50 to-transparent dark:from-indigo-900/10 dark:via-purple-900/10 pointer-events-none" />
          <form
            onSubmit={handleSearch}
            className="flex flex-col sm:flex-row gap-4 relative z-10 p-2 sm:p-4"
          >
            <div className="relative flex-1">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-indigo-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nhập họ tên, SBD hoặc email thí sinh..."
                className="h-14 w-full rounded-2xl border-2 border-transparent bg-white/80 dark:bg-slate-900/60 pl-14 pr-4 text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-900 focus:shadow-[0_0_20px_rgba(99,102,241,0.15)] shadow-sm backdrop-blur-md"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-14 rounded-2xl px-8 shadow-lg shadow-indigo-500/30 text-base font-bold tracking-wide"
            >
              Tra cứu
            </Button>
          </form>
        </Card>
      </motion.div>

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <Skeleton className="h-[500px] w-full rounded-3xl" />
          <Skeleton className="h-[500px] w-full rounded-3xl" />
        </div>
      )}

      {student && !isLoading && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.1 } },
          }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8"
        >
          <div className="space-y-8">
            <motion.div variants={itemAnim}>
              <Card className="relative overflow-hidden glass-card p-8 rounded-3xl border border-white/50 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-none">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <User className="h-32 w-32" />
                </div>
                <div className="relative z-10">
                  <h2 className="text-sm font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />{" "}
                    Hồ Sơ Thí Sinh
                  </h2>

                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                        Họ và tên
                      </p>
                      <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                        {student.name}
                      </p>
                    </div>
                    {responses && (
                      <div>
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                          Tài khoản liên kết
                        </p>
                        <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mt-1">
                          {responses.email || "Chưa có email"}
                        </p>
                      </div>
                    )}
                    <div className="pt-6 mt-2 border-t border-slate-200/60 dark:border-slate-800/60 grid grid-cols-2 gap-6">
                      <div className="bg-white/50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">
                          Điểm Toán (IRT)
                        </p>
                        <div className="flex items-end gap-2">
                          <span className="text-4xl font-black text-primary-600 dark:text-primary-400 tracking-tight">
                            {student.irt_toan !== null
                              ? student.irt_toan.toFixed(1)
                              : "N/A"}
                          </span>
                          <span className="text-sm text-slate-400 mb-1 font-bold">
                            /300
                          </span>
                        </div>
                      </div>
                      <div className="bg-white/50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">
                          Điểm TDKH (IRT)
                        </p>
                        <div className="flex items-end gap-2">
                          <span className="text-4xl font-black text-success-600 dark:text-success-400 tracking-tight">
                            {student.irt_tdkh !== null
                              ? student.irt_tdkh.toFixed(1)
                              : "N/A"}
                          </span>
                          <span className="text-sm text-slate-400 mb-1 font-bold">
                            /300
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemAnim}>
              <Card className="p-8 glass-card rounded-3xl border border-white/50 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 to-transparent dark:from-indigo-500/5 pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl">
                      <Target className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                      Ma Trận Kiến Thức
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-4 mb-6 text-sm font-semibold text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-success-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]"></span>{" "}
                      Trả lời đúng
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-danger-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"></span>{" "}
                      Trả lời sai
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700"></span>{" "}
                      Bỏ trống
                    </div>
                  </div>
                  {getKnowledgeMatrix()}
                </div>
              </Card>
            </motion.div>
          </div>

          <div className="space-y-8">
            <motion.div variants={itemAnim} className="h-full">
              <Card className="p-8 h-[550px] flex flex-col glass-card rounded-3xl border border-white/50 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-50/50 via-transparent to-transparent dark:from-indigo-900/20 pointer-events-none" />
                <div className="relative z-10 flex items-center gap-3 mb-8">
                  <div className="p-2.5 bg-purple-100 dark:bg-purple-500/20 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Phân tích năng lực (Radar)
                  </h3>
                </div>
                <div className="flex-1 w-full min-h-0 relative z-10 -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="75%"
                      data={getRadarData()}
                    >
                      <PolarGrid
                        stroke={isDark ? "#334155" : "#e2e8f0"}
                        strokeWidth={1.5}
                      />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{
                          fill: isDark ? "#94a3b8" : "#475569",
                          fontSize: 13,
                          fontWeight: 700,
                          fontFamily: "Inter",
                        }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 300]}
                        tick={{
                          fill: isDark ? "#64748b" : "#94a3b8",
                          fontSize: 11,
                        }}
                        axisLine={false}
                      />
                      <Radar
                        name="Điểm của bạn"
                        dataKey="Điểm của bạn"
                        stroke="#6366f1"
                        strokeWidth={3}
                        fill="#6366f1"
                        fillOpacity={0.4}
                      />
                      <Radar
                        name="Trung bình lớp"
                        dataKey="Trung bình lớp"
                        stroke={isDark ? "#475569" : "#94a3b8"}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fill={isDark ? "#334155" : "#cbd5e1"}
                        fillOpacity={0.2}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark
                            ? "rgba(15, 23, 42, 0.9)"
                            : "rgba(255, 255, 255, 0.9)",
                          borderRadius: "16px",
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.1)"
                            : "1px solid rgba(0,0,0,0.1)",
                          backdropFilter: "blur(8px)",
                          boxShadow:
                            "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          paddingTop: "20px",
                          fontFamily: "Inter",
                          fontWeight: 600,
                        }}
                        iconType="circle"
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemAnim}>
              <Card className="p-8 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 border-orange-200/50 dark:border-orange-900/50 shadow-lg shadow-orange-500/5 dark:shadow-none rounded-3xl relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
                  <AlertTriangle className="h-32 w-32 text-orange-500" />
                </div>
                <div className="relative z-10 flex items-start gap-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]">
                    <AlertTriangle className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-orange-900 dark:text-orange-100 mb-3 tracking-tight">
                      Phân tích gợi ý ôn tập
                    </h3>
                    <p className="text-base font-medium text-orange-800/80 dark:text-orange-200/80 leading-relaxed">
                      Dựa trên kết quả ma trận kiến thức, bạn nên tập trung cải
                      thiện các phần kiến thức tương ứng với các câu trả lời sai
                      (Màu đỏ). Đặc biệt lưu ý việc bỏ trống quá nhiều sẽ bị
                      phạt và làm giảm mạnh điểm số trong mô hình IRT 2PL.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
