import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart2, Search } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { useTheme } from "../../stores/themeStore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = {
  average: "#6366f1",
  max: "#10b981",
  min: "#f59e0b",
};

export default function ExamComparePage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamIds, setSelectedExamIds] = useState<number[]>([]);
  const [examStats, setExamStats] = useState<Record<number, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isComparing, setIsComparing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/exams?limit=100");
      const data = await res.json();
      setExams(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (id: number) => {
    setSelectedExamIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= 4) {
        alert(
          "Chỉ so sánh tối đa 4 đợt thi cùng lúc để biểu đồ hiển thị tốt nhất.",
        );
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleCompare = async () => {
    if (selectedExamIds.length < 1) return;
    setIsComparing(true);
    try {
      const newStats: Record<number, any> = {};
      await Promise.all(
        selectedExamIds.map(async (id) => {
          if (!examStats[id]) {
            const res = await fetch(
              `http://localhost:8000/api/v1/statistics/exams/${id}/overview`,
            );
            if (res.ok) {
              newStats[id] = await res.json();
            }
          }
        }),
      );
      setExamStats((prev) => ({ ...prev, ...newStats }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsComparing(false);
    }
  };

  const filteredExams = useMemo(() => {
    return exams.filter((e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [exams, searchTerm]);

  const chartData = useMemo(() => {
    return selectedExamIds
      .map((id) => {
        const stats = examStats[id];
        const exam = exams.find((e) => e.id === id);
        if (!stats || !exam) return null;
        return {
          name:
            exam.name.length > 20
              ? exam.name.substring(0, 20) + "..."
              : exam.name,
          "Trung bình": parseFloat((stats.average_score || 0).toFixed(1)),
          "Cao nhất": parseFloat((stats.max_score || 0).toFixed(1)),
          "Thấp nhất": parseFloat((stats.min_score || 0).toFixed(1)),
        };
      })
      .filter(Boolean);
  }, [selectedExamIds, examStats, exams]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-white/40 dark:bg-slate-800/40" />
        <Skeleton className="h-[500px] w-full rounded-2xl bg-white/40 dark:bg-slate-800/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/exams")}
          className="rounded-full bg-white/80 dark:bg-slate-800/80 shadow-sm border border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700 backdrop-blur-md"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">
            So sánh Kỳ thi
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Phân tích chênh lệch chất lượng điểm số giữa các đợt thi
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Selector */}
        <Card className="p-0 overflow-hidden glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 xl:col-span-1 h-[600px] flex flex-col">
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-800 dark:text-slate-200 flex justify-between items-center shrink-0">
            <span>
              Chọn kỳ thi{" "}
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/50 px-2 py-0.5 text-[10px] font-bold text-primary-700 dark:text-primary-400">
                {selectedExamIds.length}/4
              </span>
            </span>
            <Button
              size="sm"
              onClick={handleCompare}
              disabled={selectedExamIds.length === 0 || isComparing}
              className="shadow-lg shadow-primary-500/20"
            >
              {isComparing ? "Đang tải..." : "Xem biểu đồ"}
            </Button>
          </div>

          <div className="p-3 shrink-0 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm kỳ thi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {filteredExams.length === 0 && (
              <div className="p-8 text-center flex flex-col items-center gap-2 opacity-60">
                <Search className="h-8 w-8 text-slate-400" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Không tìm thấy kỳ thi nào.
                </p>
              </div>
            )}
            {filteredExams.map((exam) => (
              <label
                key={exam.id}
                className={`group flex items-start gap-3 p-3 mb-1 cursor-pointer rounded-xl transition-all border ${selectedExamIds.includes(exam.id) ? "bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/30 shadow-sm" : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60"}`}
              >
                <input
                  type="checkbox"
                  className="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 bg-white dark:bg-slate-900"
                  checked={selectedExamIds.includes(exam.id)}
                  onChange={() => handleSelect(exam.id)}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold truncate transition-colors ${selectedExamIds.includes(exam.id) ? "text-primary-900 dark:text-primary-300" : "text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white"}`}
                  >
                    {exam.name}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                    {new Date(exam.start_time).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </Card>

        {/* Chart & Table */}
        <div className="xl:col-span-2 space-y-6">
          <Card className="p-6 glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 h-[400px] flex flex-col relative overflow-hidden group">
            <div className="absolute inset-0 z-0 bg-gradient-to-tr from-primary-500/5 via-transparent to-indigo-500/5 pointer-events-none opacity-50 dark:opacity-20" />

            <h3 className="relative z-10 text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                <BarChart2 className="w-4 h-4" />
              </div>
              Biểu đồ Phân bố Điểm số
            </h3>

            {chartData.length > 0 ? (
              <div className="relative z-10 flex-1 w-full min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    barGap={6}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={isDark ? "#334155" : "#e2e8f0"}
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: isDark ? "#94a3b8" : "#64748b",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: isDark ? "#94a3b8" : "#64748b",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                      dx={-10}
                    />
                    <Tooltip
                      cursor={{
                        fill: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9",
                      }}
                      contentStyle={{
                        backgroundColor: isDark
                          ? "rgba(15, 23, 42, 0.95)"
                          : "rgba(255, 255, 255, 0.95)",
                        borderRadius: "16px",
                        border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                        boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)",
                        color: isDark ? "#f8fafc" : "#0f172a",
                        fontWeight: 600,
                        backdropFilter: "blur(12px)",
                      }}
                      itemStyle={{ fontWeight: 700 }}
                    />
                    <Legend
                      wrapperStyle={{
                        paddingTop: "20px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: isDark ? "#cbd5e1" : "#475569",
                      }}
                    />
                    <Bar
                      dataKey="Trung bình"
                      fill={COLORS.average}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Bar
                      dataKey="Cao nhất"
                      fill={COLORS.max}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Bar
                      dataKey="Thấp nhất"
                      fill={COLORS.min}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                <BarChart2 className="h-12 w-12 opacity-20 mb-3" />
                <p className="font-medium">
                  Vui lòng chọn kỳ thi và bấm "Xem biểu đồ"
                </p>
              </div>
            )}
          </Card>

          {/* Detail Table */}
          {chartData.length > 0 && (
            <Card className="p-0 overflow-hidden glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 animate-in slide-in-from-bottom-4 duration-500">
              <div className="p-4 bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">
                  Bảng Tổng hợp Cụ thể
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-6 py-4 font-bold">Tên Kỳ thi</th>
                      <th className="px-6 py-4 font-bold text-right">
                        Lượt nộp
                      </th>
                      <th className="px-6 py-4 font-bold text-right">
                        Trung bình
                      </th>
                      <th className="px-6 py-4 font-bold text-right">
                        Cao nhất
                      </th>
                      <th className="px-6 py-4 font-bold text-right">
                        Thấp nhất
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800">
                    {selectedExamIds.map((id) => {
                      const stats = examStats[id];
                      const exam = exams.find((e) => e.id === id);
                      if (!stats || !exam) return null;
                      return (
                        <tr
                          key={id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800 dark:text-slate-200">
                              {exam.name}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-600 dark:text-slate-400">
                            {stats.total_participants || 0}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-flex items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              {(stats.average_score || 0).toFixed(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {(stats.max_score || 0).toFixed(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-flex items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                              {(stats.min_score || 0).toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
