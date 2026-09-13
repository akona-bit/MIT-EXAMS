import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { ArrowLeft, LineChart as LineChartIcon, Activity, TrendingUp, BarChart3 } from "lucide-react";
import Button from "../../components/ui/Button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion } from "framer-motion";

interface CompareItem {
  name: string;
  score: number | null;
  max_score: number;
}

export default function StudentComparePage() {
  const navigate = useNavigate();
  const [compareData, setCompareData] = useState<{ name: string; score: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/v1/exams/my-history")
      .then((res) => {
        const items: CompareItem[] = res.data.items || [];
        const scored = items
          .filter((h) => h.score !== null)
          .map((h) => ({
            name: h.name.length > 15 ? h.name.slice(0, 15) + "..." : h.name,
            score: h.score || 0,
          }));
        setCompareData(scored);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const avgScore =
    compareData.length > 0
      ? Math.round((compareData.reduce((a, b) => a + b.score, 0) / compareData.length) * 10) / 10
      : 0;
  const maxScore = compareData.length > 0 ? Math.max(...compareData.map((d) => d.score)) : 0;
  const minScore = compareData.length > 0 ? Math.min(...compareData.map((d) => d.score)) : 0;

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-primary-600 to-purple-600">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2Mmgxem0tNC04di0ySDI0djJoMnptOC04VjhoLTJ2Mmg4em0tNC00VjRoLTJ2Mmg0eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <Button
              variant="ghost"
              className="text-white hover:bg-white/20 hover:text-white mb-6 -ml-2 font-bold"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5 mr-2" /> Quay lại
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-4"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-2xl">
              <LineChartIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                So sánh Năng lực
              </h1>
              <p className="text-white/70 mt-1 font-medium">
                Theo dõi tiến độ học tập qua các kỳ thi
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 pb-12 relative z-10">
        {/* Stats Row */}
        {!isLoading && compareData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-3 gap-3 sm:gap-4 mb-6"
          >
            {[
              { label: "Điểm TB", value: avgScore, icon: BarChart3, color: "from-blue-500 to-indigo-600" },
              { label: "Cao nhất", value: maxScore, icon: TrendingUp, color: "from-emerald-500 to-teal-600" },
              { label: "Thấp nhất", value: minScore, icon: Activity, color: "from-amber-500 to-orange-600" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-md`}
                  >
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden"
        >
          <div className="px-6 sm:px-8 py-5 sm:py-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-500" /> Biểu đồ Điểm số
            </h2>
            {compareData.length > 0 && (
              <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                {compareData.length} kỳ thi
              </span>
            )}
          </div>

          <div className="p-6 sm:p-8 h-[400px] sm:h-[500px]">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-primary-600"></div>
              </div>
            ) : compareData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
                  <LineChartIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">
                  Chưa có dữ liệu so sánh
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                  Hãy hoàn thành ít nhất 1 kỳ thi để xem biểu đồ so sánh
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={compareData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "16px",
                      border: "none",
                      boxShadow:
                        "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
                      padding: "16px",
                    }}
                    labelStyle={{ fontWeight: "bold", color: "#1e293b", marginBottom: "8px" }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "20px" }} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Điểm số"
                    stroke="url(#lineGradient)"
                    strokeWidth={4}
                    dot={{ r: 6, strokeWidth: 3, fill: "#fff" }}
                    activeDot={{ r: 8, fill: "#6366f1", strokeWidth: 3, stroke: "#fff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
