import { useState, useEffect, useMemo } from "react";
import { getActivityHeatmap, type ActivityHeatmapResponse, type ActivityDay } from "../../api/studentProfile";
import { Loader2, Flame, Calendar, Eye } from "lucide-react";

function getIntensityClass(day: ActivityDay): string {
  if (day.total_activity === 0) return "bg-slate-100 dark:bg-slate-800";
  if (day.is_strengthened) return "bg-emerald-400 dark:bg-emerald-500";
  
  if (day.total_activity === 1) return "bg-indigo-200 dark:bg-indigo-900";
  if (day.total_activity <= 3) return "bg-indigo-300 dark:bg-indigo-700";
  if (day.total_activity <= 5) return "bg-indigo-400 dark:bg-indigo-600";
  return "bg-indigo-500 dark:bg-indigo-500";
}

export default function ActivityHeatmapCard({ studentId }: { studentId: number }) {
  const [data, setData] = useState<ActivityHeatmapResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<ActivityDay | null>(null);

  useEffect(() => {
    getActivityHeatmap(studentId)
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [studentId]);

  // Build 8-week grid (7 rows × 8 cols)
  const grid = useMemo(() => {
    if (!data) return [];
    const today = new Date();
    const dayMap = new Map(data.days.map(d => [d.date, d]));

    const weeks: (ActivityDay | null)[][] = [];
    // Go back 8 weeks from today (56 days)
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 55); // 56 days total
    // Align to Monday
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - ((dayOfWeek + 6) % 7));

    let current = new Date(startDate);
    let currentWeek: (ActivityDay | null)[] = [];

    while (current <= today) {
      const iso = current.toISOString().slice(0, 10);
      const activity = dayMap.get(iso);
      currentWeek.push(
        activity || {
          date: iso,
          submissions: 0,
          lessons: 0,
          forum: 0,
          watch_minutes: 0,
          is_strengthened: false,
          total_activity: 0,
        }
      );
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      current.setDate(current.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    return weeks;
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-[#faf9fd] dark:bg-slate-900/80 p-6 flex items-center justify-center min-h-[200px] shadow-sm">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-[#faf9fd] dark:bg-slate-900/80 p-6 flex flex-col items-center justify-center min-h-[200px] text-center shadow-sm hover:shadow-md transition-shadow">
        <div className="relative mb-5 flex items-center justify-center">
          <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-900/30 blur-xl rounded-full scale-150"></div>
          <Flame className="w-12 h-12 text-indigo-400 dark:text-indigo-500 relative z-10" strokeWidth={1.5} />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1.5">Chuỗi Hoạt Động</h3>
        <p className="text-slate-500 text-sm max-w-[260px] leading-relaxed">Hoàn thành bài thi chuẩn hóa V-ACT đầu tiên để mở khoá biểu đồ này.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-[#faf9fd] dark:bg-slate-900/80 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col w-fit min-w-[340px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Flame className="w-5 h-5 text-indigo-500" />
          Sức mạnh 8 tuần gần đây
        </h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
          <span>{data.summary.active_days}/{data.summary.total_days} ngày</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-full shadow-sm text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <Flame className="w-3.5 h-3.5 text-emerald-500" />
          <span>{data.summary.strengthened_days} ngày mạnh lên</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-full shadow-sm text-xs font-semibold text-indigo-700 dark:text-indigo-400">
          <Eye className="w-3.5 h-3.5 text-indigo-500" />
          <span>{data.summary.total_watch_minutes} phút xem</span>
        </div>
      </div>

      <div className="w-full">
        {/* Heatmap grid */}
        <div className="flex gap-1 overflow-x-auto pb-2 custom-scrollbar">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1 shrink-0">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="w-5 h-5" />;
                const intensityClass = getIntensityClass(day);

                return (
                  <div
                    key={di}
                    className={`w-5 h-5 rounded-[4px] cursor-pointer transition-all hover:scale-125 hover:ring-2 hover:ring-indigo-400 hover:ring-offset-1 dark:hover:ring-offset-slate-900 relative ${intensityClass}`}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
          {/* Legend */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <span>Ít</span>
            <div className="flex gap-[3px]">
              <div className="w-[12px] h-[12px] rounded-[3px] bg-slate-100 dark:bg-slate-800"></div>
              <div className="w-[12px] h-[12px] rounded-[3px] bg-indigo-200 dark:bg-indigo-900"></div>
              <div className="w-[12px] h-[12px] rounded-[3px] bg-indigo-300 dark:bg-indigo-700"></div>
              <div className="w-[12px] h-[12px] rounded-[3px] bg-indigo-400 dark:bg-indigo-600"></div>
              <div className="w-[12px] h-[12px] rounded-[3px] bg-indigo-500 dark:bg-indigo-500"></div>
            </div>
            <span>Nhiều</span>
            <span className="mx-1 text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <div className="w-[12px] h-[12px] rounded-[3px] bg-emerald-400 dark:bg-emerald-500"></div>
              <span>Mạnh lên</span>
            </div>
          </div>
          
          {/* Tooltip inline replacement (so it doesn't jump) */}
          <div className="h-5 flex items-center justify-end min-w-[200px]">
            {hoveredDay && hoveredDay.total_activity > 0 ? (
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 animate-in fade-in">
                {new Date(hoveredDay.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}: 
                {hoveredDay.submissions > 0 ? ` ${hoveredDay.submissions} bài, ` : ""}
                {hoveredDay.lessons > 0 ? ` ${hoveredDay.lessons} học, ` : ""}
                {hoveredDay.forum > 0 ? ` ${hoveredDay.forum} thảo luận ` : ""}
                {hoveredDay.is_strengthened ? " (Mạnh lên)" : ""}
              </span>
            ) : hoveredDay ? (
              <span className="text-[11px] text-slate-400">
                {new Date(hoveredDay.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}: Không hoạt động
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
