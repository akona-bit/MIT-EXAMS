import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, Users, BarChart3, Clock, Key, ShieldCheck } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { PageTransition } from "../../../components/ui/PageTransition";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { getExamParticipants, type ExamParticipantRow } from "../../../api/admin";
import DataTable from "../../../components/ui/DataTable";

const PART_NAMES: Record<number, string> = {
  1: "Tiếng Việt",
  2: "Tiếng Anh",
  3: "Toán",
  4: "Khoa học",
};

// Colors for the charts
const COLORS = [
  "#6366f1", // indigo-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#ec4899", // pink-500
];

function formatTimeSpent(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return "-";
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return "-";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}p ${s}s`;
}

export default function AdminCompareStudentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const examIdParam = searchParams.get("exam_id");
  const pidsParam = searchParams.get("pids");

  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<ExamParticipantRow[]>([]);
  const [sections, setSections] = useState<number[]>([]);
  
  const [radarMode, setRadarMode] = useState<"raw" | "irt">("irt");

  useEffect(() => {
    if (!examIdParam || !pidsParam) {
      setLoading(false);
      return;
    }

    const examId = parseInt(examIdParam, 10);
    const pids = pidsParam.split(",").map((id) => parseInt(id.trim(), 10));

    getExamParticipants(examId, {})
      .then((data) => {
        setSections(data.sections);
        const selected = data.items
          .filter((p) => pids.includes(p.participant_id))
          .sort((a, b) => (b.total_score || 0) - (a.total_score || 0)); // Sort by IRT desc
        setParticipants(selected);
      })
      .catch((err) => console.error("Error fetching participants for compare:", err))
      .finally(() => setLoading(false));
  }, [examIdParam, pidsParam]);

  // Transform data for Radar Chart
  const radarData = useMemo(() => {
    if (sections.length === 0 || participants.length === 0) return [];
    
    return sections.map((part) => {
      const dataPoint: any = {
        subject: PART_NAMES[part] || `Phần ${part}`,
      };
      
      participants.forEach((p) => {
        const name = p.full_name || p.username || `SBD: ${p.sbd}`;
        let score = 0;
        if (radarMode === "raw") {
          score = p.ctt_scores?.[`part${part}`] || 0;
        } else {
          score = p.irt_scores?.[`part${part}`] || 0;
        }
        dataPoint[name] = score;
      });
      
      return dataPoint;
    });
  }, [sections, participants, radarMode]);

  // Transform data for Bar Chart (Total Scores)
  const barData = useMemo(() => {
    if (participants.length === 0) return [];
    
    return participants.map((p) => ({
      name: p.full_name || p.username || `SBD: ${p.sbd}`,
      raw: p.raw_total || 0,
      irt: p.total_score || 0,
    }));
  }, [participants]);

  const columns = useMemo(() => {
    const cols: any[] = [
      {
        header: "Thí sinh & Trạng thái",
        key: "name",
        width: "220px",
        render: (r: ExamParticipantRow) => (
          <div>
            <div className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]" title={r.full_name || r.username}>
              {r.full_name || r.username || "-"}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-medium text-slate-500">SBD: {r.sbd}</span>
              {r.status === "SUBMITTED" && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Đã nộp
                </span>
              )}
              {r.status === "IN_PROGRESS" && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  Đang thi
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        header: "Mã đề",
        key: "form_code",
        width: "100px",
        render: (r: ExamParticipantRow) => (
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <Key className="w-3.5 h-3.5" />
            <span className="font-mono text-xs font-semibold">{r.form_code || "-"}</span>
          </div>
        ),
      },
      {
        header: "Thời gian làm",
        key: "time",
        width: "120px",
        render: (r: ExamParticipantRow) => (
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-sm font-medium">{formatTimeSpent(r.start_time, r.submit_time)}</span>
          </div>
        ),
      },
    ];

    sections.forEach((part) => {
      cols.push({
        header: PART_NAMES[part] || `Phần ${part}`,
        key: `part${part}`,
        width: "140px",
        render: (r: ExamParticipantRow) => {
          const raw = r.ctt_scores?.[`part${part}`];
          const irt = r.irt_scores?.[`part${part}`];
          
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IRT</span>
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                  {irt !== undefined && irt !== null ? irt.toFixed(1) : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thô</span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {raw !== undefined && raw !== null ? raw : "-"}
                </span>
              </div>
            </div>
          );
        },
      });
    });

    cols.push(
      {
        header: "Tổng (Thô)",
        key: "raw_total",
        width: "100px",
        render: (r: ExamParticipantRow) => (
          <span className="text-base font-bold text-slate-700 dark:text-slate-200">{r.raw_total ?? "-"}</span>
        ),
      },
      {
        header: "Tổng (IRT)",
        key: "total_score",
        width: "120px",
        render: (r: ExamParticipantRow) => (
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              {r.total_score !== null && r.total_score !== undefined ? r.total_score.toFixed(1) : "-"}
            </span>
          </div>
        ),
      }
    );

    return cols;
  }, [sections]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!examIdParam || !pidsParam || participants.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">Không tìm thấy dữ liệu so sánh</h2>
        <Button onClick={() => navigate("/admin/students")} variant="primary">
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  return (
    <PageTransition className="space-y-6 max-w-[1400px] mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <Button variant="ghost" onClick={() => navigate("/admin/students")} className="text-slate-500 -ml-2">
          <ArrowLeft className="w-5 h-5 mr-1" /> Quay lại
        </Button>
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary-500" />
            So sánh Thí sinh chi tiết
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Kỳ thi #{examIdParam} • {participants.length} thí sinh được chọn (Sắp xếp theo Tổng điểm IRT)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart for Part Scores */}
        <Card className="p-6 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl h-[500px] flex flex-col relative">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              So sánh Điểm thành phần
            </h3>
            
            {/* Toggle Thô / IRT */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setRadarMode("raw")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                  radarMode === "raw" 
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Điểm Thô
              </button>
              <button
                onClick={() => setRadarMode("irt")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                  radarMode === "irt" 
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Điểm IRT
              </button>
            </div>
          </div>
          
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 13, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, "auto"]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                {participants.map((p, index) => {
                  const name = p.full_name || p.username || `SBD: ${p.sbd}`;
                  return (
                    <Radar
                      key={p.participant_id}
                      name={name}
                      dataKey={name}
                      stroke={COLORS[index % COLORS.length]}
                      fill={COLORS[index % COLORS.length]}
                      fillOpacity={0.4}
                    />
                  );
                })}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Bar Chart for Total Scores */}
        <Card className="p-6 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl h-[500px] flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-500" />
            So sánh Tổng điểm
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                  angle={-45}
                  textAnchor="end"
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                />
                <Legend wrapperStyle={{ paddingTop: "40px" }} />
                <Bar dataKey="raw" name="Tổng (Thô)" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={60} />
                <Bar dataKey="irt" name="Tổng (IRT)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="p-6 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">Bảng phân tích chi tiết</h3>
        <DataTable
          data={participants}
          columns={columns}
          keyExtractor={(r) => r.participant_id.toString()}
          emptyMessage="Không có dữ liệu chi tiết."
        />
      </Card>
    </PageTransition>
  );
}
