import { useState, useEffect } from "react";
import { Card } from "../../../components/ui/Card";
import Plot from "react-plotly.js";
import { useTheme } from "../../../stores/themeStore";
import { Users, TrendingUp, AlertTriangle, Target, BarChart3, LayoutDashboard, ShieldAlert, LineChart, Database } from "lucide-react";
import client from "../../../api/client";
import { getExams } from "../../../api/exams";
import { Tabs, TabList, TabTrigger, TabContent } from "../../../components/ui/Tabs";

export default function AdvancedAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [exams, setExams] = useState<any[]>([]);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    getExams(0, 100).then(res => {
      const publishedOrFinished = (res.items || []).filter(
        (e: any) => e.status === "PUBLISHED" || e.status === "FINISHED"
      );
      setExams(publishedOrFinished);
      if (publishedOrFinished.length > 0) {
        setSelectedExamId(publishedOrFinished[0].id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedExamId) fetchData(selectedExamId);
  }, [selectedExamId]);

  const fetchData = async (examId: number) => {
    setIsLoading(true);
    try {
      const base = "/api/v1/advanced-analytics";
      const safeFetch = async (path: string) => {
        try {
          const res = await client.get(path, { params: { exam_id: examId } });
          return res.data;
        } catch { return null; }
      };
      const [statusRes, dist, params, gam, box, penalty, leaderboard, stats, flagged] = await Promise.all([
        safeFetch(`${base}/status`),
        safeFetch(`${base}/distributions`),
        safeFetch(`${base}/item-parameters`),
        safeFetch(`${base}/gam-curve`),
        safeFetch(`${base}/boxplots`),
        safeFetch(`${base}/penalty-vs-irt`),
        safeFetch(`${base}/leaderboard`),
        safeFetch(`${base}/descriptive-stats`),
        safeFetch(`${base}/flagged-items`),
      ]);
      
      setData({
        status: statusRes,
        dist,
        params: params?.items ?? null,
        gam,
        box,
        penalty,
        leaderboard: leaderboard?.top_students ?? null,
        stats,
        flagged: flagged?.items ?? null,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const renderHeader = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b pb-4 border-slate-200 dark:border-slate-800">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3 pb-1">
          <BarChart3 className="w-8 h-8 text-primary-500" />
          Phân Tích Dữ Liệu (DS111)
        </h1>
        <p className="text-base text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
          Hệ thống đánh giá chuyên sâu sử dụng Item Response Theory (IRT). Các biểu đồ được chuẩn hoá và trực quan.
        </p>
      </div>
      <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700/50">
        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 pl-2">Kỳ thi:</label>
        <select
          value={selectedExamId ?? ""}
          onChange={(e) => setSelectedExamId(Number(e.target.value))}
          className="rounded-lg border-0 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 shadow-sm outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer min-w-[200px]"
        >
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
      </div>
    </div>
  );

  if (isLoading || !data) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {renderHeader()}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-12 text-center shadow-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {isLoading ? "Đang tải dữ liệu phân tích chuyên sâu..." : "Không có dữ liệu phân tích cho kỳ thi này. Hãy chắc chắn kỳ thi đã được chấm điểm."}
          </p>
        </div>
      </div>
    );
  }

  // --- Theme Setup to match Seaborn "whitegrid" & Times New Roman ---
  const seabornLayout = {
    font: { family: '"Inter", sans-serif', size: 13, color: isDark ? '#94a3b8' : '#475569' },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: { 
      gridcolor: isDark ? '#1e293b' : '#f1f5f9', 
      zerolinecolor: isDark ? '#334155' : '#e2e8f0',
      linecolor: isDark ? '#334155' : '#e2e8f0',
      linewidth: 1,
      mirror: true,
      ticks: 'outside',
      titlefont: { size: 12, color: isDark ? '#64748b' : '#64748b', family: 'Inter' },
    },
    yaxis: { 
      gridcolor: isDark ? '#1e293b' : '#f1f5f9',
      zerolinecolor: isDark ? '#334155' : '#e2e8f0', 
      linecolor: isDark ? '#334155' : '#e2e8f0',
      linewidth: 1,
      mirror: true,
      ticks: 'outside',
      titlefont: { size: 12, color: isDark ? '#64748b' : '#64748b', family: 'Inter' },
    },
    margin: { l: 60, r: 30, t: 70, b: 60 },
    showlegend: true,
    legend: { 
      bgcolor: isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.8)', 
      bordercolor: isDark ? '#334155' : '#e2e8f0', 
      borderwidth: 1, 
      font: { size: 12, family: 'Inter' }, 
      orientation: 'h' as const, 
      y: -0.2, 
      x: 0.5, 
      xanchor: 'center' as const 
    }
  };

  // Early return if core data is missing
  if (!data.params || !data.dist) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {renderHeader()}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-12 text-center shadow-sm">
          <AlertTriangle className="w-12 h-12 text-warning-500 mx-auto mb-4" />
          <p className="text-base font-medium text-slate-700 dark:text-slate-300">
            Dữ liệu phân tích chưa đầy đủ.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Hãy đảm bảo kỳ thi đã hoàn thành và có bài nộp trước khi xem phân tích IRT.
          </p>
        </div>
      </div>
    );
  }

  const titleFont = { size: 16, color: isDark ? '#f8fafc' : '#0f172a', family: 'Inter', fontWeight: 600 };
  const subTitleFont = { size: 14, color: isDark ? '#f8fafc' : '#0f172a', family: 'Inter', fontWeight: 600 };

  const mathParams = data.params.filter((p: any) => p.subject === "Toán");
  const sciParams = data.params.filter((p: any) => p.subject === "TDKH");
  
  const createParamScatter = (params: any[], color: string, name: string) => ({
    x: params.map((p: any) => p.b),
    y: params.map((p: any) => p.a),
    mode: 'markers+text',
    type: 'scatter',
    name: name,
    text: params.map((p: any) => p.question.toString()),
    textposition: 'top right',
    textfont: { family: 'Inter', size: 10, color: isDark ? '#94a3b8' : '#64748b' },
    marker: { color: color, size: 8, line: { color: isDark ? '#0f172a' : 'white', width: 1.5 } }
  });

  const plotParamsMath = createParamScatter(mathParams, '#f97316', 'Toán');
  const plotParamsSci = createParamScatter(sciParams, '#10b981', 'Khoa học');

  // 3. Plot GAM Curve (Theta vs Raw Score)
  const createGamPlot = (scatterData: any[], lineData: any, color: string, name: string) => [
    {
      x: scatterData.map(d => d.theta),
      y: scatterData.map(d => d.raw),
      mode: 'markers',
      type: 'scatter',
      name: `Thí sinh (${name})`,
      marker: { color: color, size: 5, opacity: 0.25 },
      showlegend: false
    },
    {
      x: lineData.x,
      y: lineData.y,
      mode: 'lines',
      type: 'scatter',
      name: `GAM Fit (${name})`,
      line: { color: isDark ? '#e2e8f0' : '#0f172a', width: 2.5 } 
    }
  ];

  const plotGamMath = createGamPlot(data.gam.scatter.math, data.gam.gam.math, '#f97316', 'Toán');
  const plotGamSci = createGamPlot(data.gam.scatter.sci, data.gam.gam.sci, '#10b981', 'Khoa học');

  // 4. Boxplots
  const createBox = (values: number[], color: string, name: string) => ({
    y: values,
    type: 'box',
    name: name,
    marker: { color: color },
    boxpoints: 'Outliers' as const,
    fillcolor: color,
    opacity: 0.8,
    line: { color: isDark ? '#cbd5e1' : '#334155', width: 1.5 }
  });

  const plotBoxMath = createBox(data.box.math_irt, '#fdba74', 'Đề Toán');
  const plotBoxSci = createBox(data.box.sci_irt, '#6ee7b7', 'Đề Khoa học');

  // 5. Total Distribution with KDE (Combined Math and Sci)
  const plotTotalMathDist = {
    x: data.dist.math_irt,
    type: 'histogram',
    name: 'Toán',
    marker: { color: '#8b5cf6', opacity: 0.6, line: { color: '#4c1d95', width: 1 } },
    histnorm: 'probability density',
    xbins: { start: 0, end: 300, size: 5 }
  };
  const plotTotalMathKDE = {
    x: data.dist.kde.math.x,
    y: data.dist.kde.math.y.map((y: number) => y / 300),
    mode: 'lines',
    type: 'scatter',
    name: 'KDE Toán',
    line: { color: '#4c1d95', width: 3 }
  };

  const plotTotalSciDist = {
    x: data.dist.sci_irt,
    type: 'histogram',
    name: 'Khoa học',
    marker: { color: '#10b981', opacity: 0.6, line: { color: '#065f46', width: 1 } },
    histnorm: 'probability density',
    xbins: { start: 0, end: 300, size: 5 }
  };
  const plotTotalSciKDE = {
    x: data.dist.kde.sci.x,
    y: data.dist.kde.sci.y.map((y: number) => y / 300),
    mode: 'lines',
    type: 'scatter',
    name: 'KDE Khoa học',
    line: { color: '#065f46', width: 3 }
  };

  // 6. Pie Chart: Phân loại năng lực học sinh
  const categorizeScores = (scores: number[]) => {
    let weak = 0, avg = 0, good = 0;
    scores.forEach(s => {
      if (s < 120) weak++;
      else if (s < 200) avg++;
      else good++;
    });
    return [weak, avg, good];
  };
  const mathCategories = categorizeScores(data.dist.math_irt);
  const sciCategories = categorizeScores(data.dist.sci_irt);

  const plotPieMath = {
    values: mathCategories,
    labels: ['Dưới TB (<120)', 'Khá (120-200)', 'Giỏi (>200)'],
    type: 'pie',
    name: 'Toán',
    domain: { row: 0, column: 0 },
    hoverinfo: 'label+percent+name',
    textinfo: 'percent',
    marker: { colors: ['#f43f5e', '#eab308', '#22c55e'], line: { color: isDark ? '#0b1120' : 'white', width: 3 } },
    textfont: { family: 'Inter', size: 12, color: 'white' },
    hole: 0.45
  };

  const plotPieSci = {
    values: sciCategories,
    labels: ['Dưới TB (<120)', 'Khá (120-200)', 'Giỏi (>200)'],
    type: 'pie',
    name: 'Khoa học',
    domain: { row: 0, column: 1 },
    hoverinfo: 'label+percent+name',
    textinfo: 'percent',
    marker: { colors: ['#f43f5e', '#eab308', '#22c55e'], line: { color: isDark ? '#0b1120' : 'white', width: 3 } },
    textfont: { family: 'Inter', size: 12, color: 'white' },
    hole: 0.45
  };

  // 7. Penalty vs IRT Scatter
  const plotPenaltyMath = {
    x: data.penalty.math.map((d: any) => d.penalty),
    y: data.penalty.math.map((d: any) => d.irt),
    mode: 'markers',
    type: 'scatter',
    name: 'Thí sinh (Toán)',
    marker: { color: '#0284c7', size: 6, line: { color: isDark ? '#0b1120' : 'white', width: 1 } }
  };

  const plotPenaltySci = {
    x: data.penalty.sci.map((d: any) => d.penalty),
    y: data.penalty.sci.map((d: any) => d.irt),
    mode: 'markers',
    type: 'scatter',
    name: 'Thí sinh (Khoa học)',
    marker: { color: '#059669', size: 6, line: { color: isDark ? '#0b1120' : 'white', width: 1 } }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      {renderHeader()}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="p-6 border-l-4 border-l-indigo-500 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng Thí Sinh</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-2">{data.stats.total_students}</h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
              <Users size={28} />
            </div>
          </div>
        </Card>
        
        <Card className="p-6 border-l-4 border-l-orange-500 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">TB Toán (IRT)</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-2">{data.stats.math_irt.mean}</h3>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-2xl text-orange-600 dark:text-orange-400">
              <TrendingUp size={28} />
            </div>
          </div>
        </Card>
        
        <Card className="p-6 border-l-4 border-l-emerald-500 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">TB Khoa học (IRT)</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-2">{data.stats.sci_irt.mean}</h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={28} />
            </div>
          </div>
        </Card>
        
        <Card className="p-6 border-l-4 border-l-rose-500 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Câu Bất Thường</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-2">{data.flagged.length}</h3>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400">
              <AlertTriangle size={28} />
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabList className="mb-6 inline-flex p-1.5 bg-slate-100 dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800">
          <TabTrigger value="overview" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:text-primary-600 data-[state=active]:dark:text-primary-400 data-[state=active]:shadow-sm">
            <LayoutDashboard size={18} />
            Tổng quan & Xếp hạng
          </TabTrigger>
          <TabTrigger value="irt" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:text-primary-600 data-[state=active]:dark:text-primary-400 data-[state=active]:shadow-sm">
            <LineChart size={18} />
            Biểu đồ Phân tích IRT
          </TabTrigger>
          <TabTrigger value="flagged" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:text-primary-600 data-[state=active]:dark:text-primary-400 data-[state=active]:shadow-sm">
            <ShieldAlert size={18} />
            Cảnh báo ({data.flagged.length})
          </TabTrigger>
        </TabList>

        <TabContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <Card className="p-2 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl xl:col-span-2">
              <Plot
                data={[plotPieMath as any, plotPieSci as any]}
                layout={{
                  ...seabornLayout,
                  title: { text: 'Tỷ lệ Phân loại Năng lực Thí sinh', ...titleFont, y: 0.95 },
                  grid: { rows: 1, columns: 2 },
                  showlegend: true,
                  legend: { orientation: 'h', y: -0.1, x: 0.5, xanchor: 'center', font: { color: isDark ? '#e2e8f0' : '#475569', family: 'Inter' } },
                  margin: { l: 20, r: 20, t: 80, b: 40 },
                  annotations: [
                    { text: 'Toán', x: 0.225, y: 0.5, font: { size: 16, family: 'Inter', color: isDark ? '#94a3b8' : '#64748b' }, showarrow: false },
                    { text: 'Khoa học', x: 0.775, y: 0.5, font: { size: 16, family: 'Inter', color: isDark ? '#94a3b8' : '#64748b' }, showarrow: false }
                  ]
                } as any}
                style={{ width: "100%", height: "400px" }}
                useResizeHandler={true}
                config={{ displayModeBar: false }}
              />
            </Card>
          </div>

          <Card className="bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden p-6">
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Database className="text-primary-500" size={20} /> Bảng Thống kê Mô tả
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">
                    <th className="p-4">Chỉ số</th>
                    <th className="p-4 text-right">Toán (Thô)</th>
                    <th className="p-4 text-right">Khoa học (Thô)</th>
                    <th className="p-4 text-right text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-900/10">Toán (IRT)</th>
                    <th className="p-4 text-right text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10">Khoa học (IRT)</th>
                  </tr>
                </thead>
                <tbody>
                  {['Mean', 'Median', 'SD', 'Min', 'Max'].map((metric) => (
                    <tr key={metric} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                        {metric === 'Mean' ? 'Điểm Trung bình' : metric === 'Median' ? 'Trung vị' : metric === 'SD' ? 'Độ lệch chuẩn' : metric === 'Min' ? 'Thấp nhất' : 'Cao nhất'}
                      </td>
                      <td className="p-4 text-right text-slate-600 dark:text-slate-400 font-medium">{data.stats.math_raw[metric.toLowerCase()]}</td>
                      <td className="p-4 text-right text-slate-600 dark:text-slate-400 font-medium">{data.stats.sci_raw[metric.toLowerCase()]}</td>
                      <td className="p-4 text-right text-orange-600 dark:text-orange-400 font-bold bg-orange-50/30 dark:bg-orange-900/5">{data.stats.math_irt[metric.toLowerCase()]}</td>
                      <td className="p-4 text-right text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/30 dark:bg-emerald-900/5">{data.stats.sci_irt[metric.toLowerCase()]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden p-6">
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Target className="text-primary-500" size={20} /> Top 10 Thí sinh Xuất sắc (Leaderboard)
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">
                    <th className="p-4 w-20 text-center">Hạng</th>
                    <th className="p-4">Họ và Tên</th>
                    <th className="p-4 text-right text-orange-600 dark:text-orange-400">Toán (IRT)</th>
                    <th className="p-4 text-right text-emerald-600 dark:text-emerald-400">Khoa học (IRT)</th>
                    <th className="p-4 text-right text-indigo-600 dark:text-indigo-400">Tổng điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((student: any) => (
                    <tr key={student.rank} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-black text-center text-slate-700 dark:text-slate-300">
                        {student.rank === 1 ? '🥇' : student.rank === 2 ? '🥈' : student.rank === 3 ? '🥉' : student.rank}
                      </td>
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{student.name}</td>
                      <td className="p-4 text-right text-orange-600 dark:text-orange-400 font-bold">{student.math_irt}</td>
                      <td className="p-4 text-right text-emerald-600 dark:text-emerald-400 font-bold">{student.sci_irt}</td>
                      <td className="p-4 text-right font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-l-md">{student.total_irt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabContent>

        <TabContent value="irt" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="p-2 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden xl:col-span-2">
              <Plot
                data={[
                  plotTotalMathDist as any, plotTotalMathKDE as any,
                  plotTotalSciDist as any, plotTotalSciKDE as any
                ]}
                layout={{
                  ...seabornLayout,
                  title: { text: 'Phân bố điểm IRT (0-300)', ...titleFont },
                  xaxis: { ...seabornLayout.xaxis, title: 'Điểm chuẩn hóa (0-300)', range: [0, 300] },
                  yaxis: { ...seabornLayout.yaxis, title: 'Mật độ' },
                  barmode: 'overlay',
                } as any}
                style={{ width: "100%", height: "480px" }}
                useResizeHandler={true}
                config={{ displayModeBar: false }}
              />
            </Card>
            
            <Card className="p-2 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <Plot
                data={[...plotGamMath as any]}
                layout={{
                  ...seabornLayout,
                  title: { text: 'Đường cong GAM (Môn Toán)', ...subTitleFont },
                  xaxis: { ...seabornLayout.xaxis, title: 'Năng lực Theta (-3 đến 3)', range: [-3, 3] },
                  yaxis: { ...seabornLayout.yaxis, title: 'Điểm thô (0-300)', range: [0, 300] },
                } as any}
                style={{ width: "100%", height: "420px" }}
                useResizeHandler={true}
                config={{ displayModeBar: false }}
              />
            </Card>

            <Card className="p-2 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <Plot
                data={[...plotGamSci as any]}
                layout={{
                  ...seabornLayout,
                  title: { text: 'Đường cong GAM (Môn Khoa học)', ...subTitleFont },
                  xaxis: { ...seabornLayout.xaxis, title: 'Năng lực Theta (-3 đến 3)', range: [-3, 3] },
                  yaxis: { ...seabornLayout.yaxis, title: 'Điểm thô (0-300)', range: [0, 300] },
                } as any}
                style={{ width: "100%", height: "420px" }}
                useResizeHandler={true}
                config={{ displayModeBar: false }}
              />
            </Card>
            
            <Card className="p-2 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <Plot
                data={[plotBoxMath as any, plotBoxSci as any]}
                layout={{
                  ...seabornLayout,
                  title: { text: 'Phân tán Tứ phân vị (Boxplot)', ...subTitleFont },
                  xaxis: { ...seabornLayout.xaxis, title: 'Môn thi' },
                  yaxis: { ...seabornLayout.yaxis, title: 'Điểm số chuẩn hoá (0-300)', range: [0, 300] },
                  showlegend: false
                } as any}
                style={{ width: "100%", height: "420px" }}
                useResizeHandler={true}
                config={{ displayModeBar: false }}
              />
            </Card>

            <Card className="p-2 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <Plot
                data={[plotParamsMath as any, plotParamsSci as any]}
                layout={{
                  ...seabornLayout,
                  title: { text: 'Tham số Câu hỏi (a vs b)', ...subTitleFont },
                  xaxis: { ...seabornLayout.xaxis, title: 'Độ khó (b)' },
                  yaxis: { ...seabornLayout.yaxis, title: 'Độ phân biệt (a)' },
                } as any}
                style={{ width: "100%", height: "420px" }}
                useResizeHandler={true}
                config={{ displayModeBar: false }}
              />
            </Card>

            <Card className="p-2 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <Plot
                data={[plotPenaltyMath as any]}
                layout={{
                  ...seabornLayout,
                  title: { text: 'Toán: Thưởng phạt vs Điểm chuẩn hóa IRT', ...subTitleFont },
                  xaxis: { ...seabornLayout.xaxis, title: 'Điểm thưởng phạt (0-30)' },
                  yaxis: { ...seabornLayout.yaxis, title: 'IRT Score (0-300)' },
                  showlegend: false
                } as any}
                style={{ width: "100%", height: "420px" }}
                useResizeHandler={true}
                config={{ displayModeBar: false }}
              />
            </Card>

            <Card className="p-2 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <Plot
                data={[plotPenaltySci as any]}
                layout={{
                  ...seabornLayout,
                  title: { text: 'Khoa học: Thưởng phạt vs Điểm chuẩn hóa IRT', ...subTitleFont },
                  xaxis: { ...seabornLayout.xaxis, title: 'Điểm thưởng phạt (0-30)' },
                  yaxis: { ...seabornLayout.yaxis, title: 'IRT Score (0-300)' },
                  showlegend: false
                } as any}
                style={{ width: "100%", height: "420px" }}
                useResizeHandler={true}
                config={{ displayModeBar: false }}
              />
            </Card>
          </div>
        </TabContent>

        <TabContent value="flagged" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden p-6">
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="text-rose-500" size={20} /> Câu hỏi có vấn đề (Misfit Items)
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              {data.flagged.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">
                      <th className="p-4">Câu hỏi</th>
                      <th className="p-4">Môn thi</th>
                      <th className="p-4 text-right">Độ phân biệt (a)</th>
                      <th className="p-4 text-right">Độ khó (b)</th>
                      <th className="p-4">Lý do cảnh báo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.flagged.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-black text-slate-700 dark:text-slate-300">Câu {item.question}</td>
                        <td className="p-4 font-medium text-slate-800 dark:text-slate-200">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${item.subject === 'Toán' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
                            {item.subject}
                          </span>
                        </td>
                        <td className={`p-4 text-right font-bold ${item.a < 0.5 ? 'text-rose-500' : 'text-slate-600 dark:text-slate-400'}`}>{item.a}</td>
                        <td className={`p-4 text-right font-bold ${(item.b > 3 || item.b < -3) ? 'text-rose-500' : 'text-slate-600 dark:text-slate-400'}`}>{item.b}</td>
                        <td className="p-4 text-rose-600 dark:text-rose-400 font-medium text-sm">
                          <ul className="list-disc pl-4 space-y-1">
                            {item.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                  <ShieldAlert className="mx-auto mb-4 text-emerald-500" size={40} />
                  <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">Không có câu hỏi nào bị cảnh báo.</p>
                  <p className="mt-1">Tất cả các câu hỏi đều có độ phân biệt và độ khó trong ngưỡng an toàn.</p>
                </div>
              )}
            </div>
          </Card>
        </TabContent>
      </Tabs>
    </div>
  );
}
