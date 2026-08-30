import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Trophy } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { useTheme } from "../../../stores/themeStore";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899"];

export default function StudentComparePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const namesParam = searchParams.get("names");
  
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!namesParam) {
      navigate("/admin/students");
      return;
    }

    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("http://localhost:8000/api/v1/analytics/students");
        const data = await res.json();
        const allStudents = data.items || [];
        
        const namesToCompare = namesParam.split(",").map(n => decodeURIComponent(n));
        const matched = allStudents.filter((s: any) => namesToCompare.includes(s.name));
        setStudents(matched);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudents();
  }, [namesParam, navigate]);

  const radarData = useMemo(() => {
    if (students.length === 0) return [];
    
    return [
      {
        subject: "Toán (IRT)",
        ...students.reduce((acc, s) => ({ ...acc, [s.name]: parseFloat(((s.irt_toan || 0) * 10).toFixed(1)) }), {})
      },
      {
        subject: "TDKH (IRT)",
        ...students.reduce((acc, s) => ({ ...acc, [s.name]: parseFloat(((s.irt_tdkh || 0) * 10).toFixed(1)) }), {})
      },
      {
        subject: "Toán (Thô)",
        ...students.reduce((acc, s) => ({ ...acc, [s.name]: parseFloat(((s.tho_toan || 0) / 30 * 100).toFixed(1)) }), {}) 
      },
      {
        subject: "TDKH (Thô)",
        ...students.reduce((acc, s) => ({ ...acc, [s.name]: parseFloat(((s.tho_tdkh || 0) / 30 * 100).toFixed(1)) }), {}) 
      },
      {
        subject: "Tổng IRT",
        ...students.reduce((acc, s) => ({ ...acc, [s.name]: parseFloat((((s.irt_toan || 0) + (s.irt_tdkh || 0)) * 5).toFixed(1)) }), {}) 
      }
    ];
  }, [students]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-white/40 dark:bg-slate-800/40" />
        <Skeleton className="h-[400px] w-full rounded-2xl bg-white/40 dark:bg-slate-800/40" />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/50 mb-4">
          <Users className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Không tìm thấy thí sinh nào để so sánh.</h2>
        <Button onClick={() => navigate("/admin/students")} className="mt-6 shadow-lg shadow-primary-500/20">Quay lại quản lý</Button>
      </div>
    );
  }

  // Find winner
  let winner = students[0];
  let maxScore = (students[0].irt_toan || 0) + (students[0].irt_tdkh || 0);
  for (let i = 1; i < students.length; i++) {
    const score = (students[i].irt_toan || 0) + (students[i].irt_tdkh || 0);
    if (score > maxScore) {
      maxScore = score;
      winner = students[i];
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/students")} className="rounded-full bg-white/80 dark:bg-slate-800/80 shadow-sm border border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700 backdrop-blur-md">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">So sánh Năng lực</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Đánh giá tương quan giữa {students.length} thí sinh</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <Card className="lg:col-span-2 p-6 glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center relative overflow-hidden group">
          <div className="absolute inset-0 z-0 bg-gradient-to-tr from-primary-500/5 via-transparent to-indigo-500/5 pointer-events-none opacity-50 dark:opacity-20" />
          
          <h3 className="relative z-10 text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 w-full flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
            Biểu đồ tương quan đa chiều
          </h3>
          <div className="relative z-10 w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                <PolarGrid stroke={isDark ? "#334155" : "#e2e8f0"} />
                <PolarAngleAxis dataKey="subject" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 13, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '16px', 
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontWeight: 600,
                    backdropFilter: 'blur(12px)'
                  }}
                  itemStyle={{ fontWeight: 700 }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#475569' }} />
                {students.map((s, i) => (
                  <Radar
                    key={s.name}
                    name={s.name}
                    dataKey={s.name}
                    stroke={COLORS[i % COLORS.length]}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={0.4}
                    strokeWidth={2}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Winner Highlight & Stats */}
        <div className="space-y-6">
          <Card className="p-6 glass-card shadow-lg border border-slate-200/60 dark:border-white/10 bg-gradient-to-br from-indigo-500 to-purple-600 text-white animate-in slide-in-from-right-4 duration-500">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-indigo-100 font-medium text-sm">Điểm cao nhất</p>
                <h3 className="text-xl font-bold mt-1 line-clamp-2" title={winner.name}>{winner.name}</h3>
              </div>
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm shadow-inner">
                <Trophy className="w-6 h-6 text-yellow-300 drop-shadow-md" />
              </div>
            </div>
            <div className="mt-6 flex items-end gap-2">
              <p className="text-4xl font-extrabold tracking-tight">{maxScore.toFixed(1)}</p>
              <span className="text-lg font-medium text-indigo-200 mb-1">IRT</span>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Chi tiết điểm số</h3>
            </div>
            <div className="divide-y divide-slate-100/80 dark:divide-slate-800">
              {students.map((s, i) => (
                <div key={s.name} className="p-4 flex items-center gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                  <div className="w-3 h-10 rounded-full shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 dark:text-slate-200 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" title={s.name}>{s.name}</p>
                    <div className="flex gap-3 mt-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">Toán: {(s.irt_toan || 0).toFixed(1)}</span>
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">TDKH: {(s.irt_tdkh || 0).toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="text-right pl-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Tổng</p>
                    <p className="font-black text-lg text-indigo-600 dark:text-indigo-400 leading-none">{((s.irt_toan || 0) + (s.irt_tdkh || 0)).toFixed(1)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
