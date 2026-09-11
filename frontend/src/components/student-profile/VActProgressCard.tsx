import { useState, useEffect } from "react";
import { getVActProgress, type VActProgressResponse } from "../../api/studentProfile";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const SUBJECT_LABELS: Record<string, string> = {
  total_score: "Tổng điểm",
  tieng_viet: "Tiếng Việt",
  tieng_anh: "Tiếng Anh",
  toan_hoc: "Toán học",
  tu_duy_khoa_hoc: "Tư duy KH",
};

function StatDelta({ label, value, delta }: { label: string; value: number | null; delta?: number }) {
  return (
    <div className="flex flex-col items-center p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm min-w-[100px]">
      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{label}</span>
      <span className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
        {value !== null && value !== undefined ? Math.round(value) : "—"}
      </span>
      {delta !== undefined && delta !== 0 && (
        <span className={`flex items-center gap-0.5 text-xs font-bold mt-0.5 ${delta > 0 ? "text-emerald-500" : "text-rose-500"}`}>
          {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {delta > 0 ? "+" : ""}{Math.round(delta)}
        </span>
      )}
    </div>
  );
}

export default function VActProgressCard({ studentId }: { studentId: number }) {
  const [data, setData] = useState<VActProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getVActProgress(studentId)
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [studentId]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-[#faf9fd] dark:bg-slate-900/80 p-6 flex items-center justify-center min-h-[280px] shadow-sm">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data || data.series.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-[#faf9fd] dark:bg-slate-900/80 p-6 flex flex-col items-center justify-center min-h-[280px] text-center shadow-sm hover:shadow-md transition-shadow">
        <div className="relative mb-5 flex items-center justify-center">
          <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-900/30 blur-xl rounded-full scale-150"></div>
          <TrendingUp className="w-12 h-12 text-indigo-400 dark:text-indigo-500 relative z-10" strokeWidth={1.5} />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1.5">Chưa có dữ liệu tiến độ</h3>
        <p className="text-slate-500 text-sm max-w-[260px] leading-relaxed">Hoàn thành bài thi chuẩn hóa V-ACT đầu tiên để mở khoá biểu đồ này.</p>
      </div>
    );
  }

  // Prepare chart data
  const chartData = data.series.map((entry, i) => ({
    name: entry.date
      ? new Date(entry.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
      : `#${i + 1}`,
    score: entry.has_irt_score ? entry.total_score : null,
    raw: entry.raw_total_score,
    hasIrt: entry.has_irt_score,
  }));

  const totalScore = data.current?.total_score;
  const totalDelta = data.deltas?.total_score;

  return (
    <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-[#faf9fd] dark:bg-slate-900/80 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tiến độ V-ACT</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.irt_submissions}/{data.total_submissions} lượt có điểm IRT
            {data.total_submissions > data.irt_submissions && (
              <span className="text-slate-400"> — lượt còn lại hiển thị nét đứt</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {totalScore !== null && totalScore !== undefined ? Math.round(totalScore) : "—"}
          </div>
          {totalDelta !== undefined && totalDelta !== 0 && (
            <span className={`flex items-center justify-end gap-1 text-sm font-bold ${totalDelta > 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {totalDelta > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {totalDelta > 0 ? "▲" : "▼"}{Math.abs(Math.round(totalDelta))}
              {data.first_date && (
                <span className="text-slate-400 text-xs font-normal ml-1">
                  so với {new Date(data.first_date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Area Chart */}
      <div className="h-[220px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94A3B8" />
            <YAxis domain={[0, 1200]} tick={{ fontSize: 11 }} stroke="#94A3B8" />
            <Tooltip
              contentStyle={{
                background: "white",
                border: "1px solid #E2E8F0",
                borderRadius: "12px",
                fontSize: "12px",
              }}
              formatter={(value: any) => [value != null ? Math.round(Number(value)) : "Chưa có IRT", "Điểm"]}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#6366F1"
              strokeWidth={2.5}
              fill="url(#colorScore)"
              connectNulls={false}
              dot={{ r: 4, fill: "#6366F1", stroke: "white", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: "#6366F1", stroke: "white", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Subject stats row */}
      <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
        {Object.entries(SUBJECT_LABELS).map(([key, label]) => (
          <StatDelta
            key={key}
            label={label}
            value={data.current?.[key] ?? null}
            delta={data.deltas?.[key]}
          />
        ))}
      </div>
    </div>
  );
}
