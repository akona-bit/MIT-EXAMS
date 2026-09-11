import { useState, useEffect } from "react";
import { getVActRadar, type VActRadarResponse } from "../../api/studentProfile";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend,
} from "recharts";

const SUBJECTS = [
  { key: "tieng_viet", label: "Tiếng Việt" },
  { key: "tieng_anh", label: "Tiếng Anh" },
  { key: "toan_hoc", label: "Toán học" },
  { key: "tu_duy_khoa_hoc", label: "Tư duy KH" },
];

export default function VActRadarCard({ studentId }: { studentId: number }) {
  const [data, setData] = useState<VActRadarResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getVActRadar(studentId)
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

  if (!data || !data.latest) {
    return (
      <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-[#faf9fd] dark:bg-slate-900/80 p-6 flex flex-col items-center justify-center min-h-[280px] text-center shadow-sm hover:shadow-md transition-shadow">
        <div className="relative mb-5 flex items-center justify-center">
          <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-900/30 blur-xl rounded-full scale-150"></div>
          <TrendingUp className="w-12 h-12 text-indigo-400 dark:text-indigo-500 relative z-10" strokeWidth={1.5} />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1.5">Radar Năng Lực</h3>
        <p className="text-slate-500 text-sm max-w-[200px] leading-relaxed">Hoàn thành bài thi chuẩn hóa V-ACT đầu tiên để mở khoá biểu đồ này.</p>
      </div>
    );
  }

  // Build radar data
  const radarData = SUBJECTS.map(({ key, label }) => ({
    subject: label,
    latest: (data.latest as any)?.[key] ?? 0,
    previous: (data.previous as any)?.[key] ?? 0,
  }));

  return (
    <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-[#faf9fd] dark:bg-slate-900/80 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">V-ACT</h3>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-black text-primary-600 dark:text-primary-400">
            {data.latest.total !== null ? Math.round(data.latest.total) : "—"}
          </span>
          <span className="text-xs font-semibold text-slate-400">/1200</span>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="h-[240px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid stroke="#E2E8F0" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#64748B" }} />
            <PolarRadiusAxis domain={[0, 300]} tick={{ fontSize: 9 }} tickCount={4} />
            {data.previous && (
              <Radar
                name="Lần trước"
                dataKey="previous"
                stroke="#94A3B8"
                fill="#94A3B8"
                fillOpacity={0.1}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            )}
            <Radar
              name="Lần gần nhất"
              dataKey="latest"
              stroke="#6366F1"
              fill="#6366F1"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", fontWeight: 600 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Subject progress bars */}
      <div className="space-y-3 mt-4">
        {SUBJECTS.map(({ key, label }) => {
          const score = (data.latest as any)?.[key] ?? 0;
          const delta = data.deltas?.[key];
          const pct = Math.min((score / 300) * 100, 100);

          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{Math.round(score)}</span>
                  {delta !== undefined && delta !== 0 && (
                    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${delta > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {delta > 0 ? "+" : ""}{Math.round(delta)}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
