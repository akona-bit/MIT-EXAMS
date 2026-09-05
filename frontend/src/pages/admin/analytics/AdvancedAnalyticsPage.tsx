import { useState, useEffect } from "react";
import { Card } from "../../../components/ui/Card";
import Plot from "react-plotly.js";
import { useTheme } from "../../../stores/themeStore";
import { Users, TrendingUp, AlertTriangle, Target, BarChart3 } from "lucide-react";
import client from "../../../api/client";

export default function AdvancedAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const base = "/api/v1/advanced-analytics";
      const safeFetch = async (path: string) => {
        try {
          const res = await client.get(path);
          return res.data;
        } catch { return null; }
      };
      const [dist, params, gam, box, penalty, leaderboard, stats, flagged] = await Promise.all([
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

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
          <p className="text-sm text-slate-500">
            {isLoading ? "Đang tải dữ liệu phân tích..." : "Không có dữ liệu phân tích. Hãy hoàn thành ít nhất 1 kỳ thi."}
          </p>
        </div>
      </div>
    );
  }

  // --- Theme Setup to match Seaborn "whitegrid" & Times New Roman ---
  const seabornLayout = {
    font: { family: '"Times New Roman", Times, serif', size: 14, color: isDark ? '#e2e8f0' : '#222' },
    paper_bgcolor: isDark ? '#1e293b' : '#f8fafc', // Slight gray background for premium card feel
    plot_bgcolor: isDark ? '#0f172a' : 'white',
    xaxis: { 
      gridcolor: isDark ? '#334155' : '#e2e8f0', 
      zerolinecolor: isDark ? '#475569' : '#cbd5e1',
      linecolor: isDark ? '#475569' : '#cbd5e1',
      linewidth: 1,
      mirror: true,
      ticks: 'outside',
      titlefont: { size: 13, color: isDark ? '#94a3b8' : '#475569' },
    },
    yaxis: { 
      gridcolor: isDark ? '#334155' : '#e2e8f0',
      zerolinecolor: isDark ? '#475569' : '#cbd5e1', 
      linecolor: isDark ? '#475569' : '#cbd5e1',
      linewidth: 1,
      mirror: true,
      ticks: 'outside',
      titlefont: { size: 13, color: isDark ? '#94a3b8' : '#475569' },
    },
    margin: { l: 50, r: 30, t: 60, b: 50 },
    showlegend: true,
    legend: { 
      bgcolor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)', 
      bordercolor: isDark ? '#334155' : '#e2e8f0', 
      borderwidth: 1, 
      font: { size: 12 }, 
      orientation: 'h' as const, 
      y: -0.15, 
      x: 0.5, 
      xanchor: 'center' as const 
    }
  };

  // Early return if core data is missing
  if (!data.params || !data.dist) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
          <p className="text-sm text-slate-500">
            Dữ liệu phân tích chưa đầy đủ. Hãy đảm bảo kỳ thi đã hoàn thành và có bài nộp.
          </p>
        </div>
      </div>
    );
  }

  const titleFont = { size: 18, color: isDark ? '#f8fafc' : '#0f172a', family: 'Inter' };
  const subTitleFont = { size: 16, color: isDark ? '#f8fafc' : '#0f172a', family: 'Inter' };


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
    textfont: { family: '"Times New Roman", Times, serif', size: 10, color: isDark ? '#94a3b8' : '#64748b' },
    marker: { color: color, size: 8, line: { color: isDark ? '#0f172a' : 'white', width: 1 } }
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
    opacity: 0.7,
    line: { color: isDark ? '#e2e8f0' : '#0f172a', width: 1.5 }
  });

  const plotBoxMath = createBox(data.box.math_irt, '#fdba74', 'Đề Toán');
  const plotBoxSci = createBox(data.box.sci_irt, '#6ee7b7', 'Đề Khoa học');

  // 5. Total Distribution with KDE (Combined Math and Sci)
  const plotTotalMathDist = {
    x: data.dist.math_irt,
    type: 'histogram',
    name: 'Toán',
    marker: { color: '#8b5cf6', opacity: 0.5, line: { color: '#4c1d95', width: 1 } },
    histnorm: 'probability density',
    xbins: { start: 0, end: 300, size: 5 }
  };
  const plotTotalMathKDE = {
    x: data.dist.kde.math.x,
    y: data.dist.kde.math.y.map((y: number) => y / 300),
    mode: 'lines',
    type: 'scatter',
    name: 'KDE Toán',
    line: { color: '#4c1d95', width: 2.5 }
  };

  const plotTotalSciDist = {
    x: data.dist.sci_irt,
    type: 'histogram',
    name: 'Khoa học',
    marker: { color: '#10b981', opacity: 0.5, line: { color: '#065f46', width: 1 } },
    histnorm: 'probability density',
    xbins: { start: 0, end: 300, size: 5 }
  };
  const plotTotalSciKDE = {
    x: data.dist.kde.sci.x,
    y: data.dist.kde.sci.y.map((y: number) => y / 300),
    mode: 'lines',
    type: 'scatter',
    name: 'KDE Khoa học',
    line: { color: '#065f46', width: 2.5 }
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
    marker: { colors: ['#f87171', '#facc15', '#4ade80'], line: { color: isDark ? '#0f172a' : 'white', width: 2 } },
    textfont: { family: '"Times New Roman", Times, serif', size: 12, color: 'white' },
    hole: 0.4
  };

  const plotPieSci = {
    values: sciCategories,
    labels: ['Dưới TB (<120)', 'Khá (120-200)', 'Giỏi (>200)'],
    type: 'pie',
    name: 'Khoa học',
    domain: { row: 0, column: 1 },
    hoverinfo: 'label+percent+name',
    textinfo: 'percent',
    marker: { colors: ['#f87171', '#facc15', '#4ade80'], line: { color: isDark ? '#0f172a' : 'white', width: 2 } },
    textfont: { family: '"Times New Roman", Times, serif', size: 12, color: 'white' },
    hole: 0.4
  };

  // 7. Penalty vs IRT Scatter
  const plotPenaltyMath = {
    x: data.penalty.math.map((d: any) => d.penalty),
    y: data.penalty.math.map((d: any) => d.irt),
    mode: 'markers',
    type: 'scatter',
    name: 'Thí sinh (Toán)',
    marker: { color: '#0284c7', size: 6, line: { color: isDark ? '#0f172a' : 'white', width: 0.5 } }
  };

  const plotPenaltySci = {
    x: data.penalty.sci.map((d: any) => d.penalty),
    y: data.penalty.sci.map((d: any) => d.irt),
    mode: 'markers',
    type: 'scatter',
    name: 'Thí sinh (Khoa học)',
    marker: { color: '#059669', size: 6, line: { color: isDark ? '#0f172a' : 'white', width: 0.5 } }
  };


  return (
    <div className="space-y-6">
      <div className="mb-8 border-b pb-4 border-slate-200 dark:border-slate-800">
        <h1 className="text-3xl font-extrabold text-gradient tracking-tight flex items-center gap-3 pb-1">
          <BarChart3 className="w-8 h-8 text-primary-500" />
          Báo Cáo Phân Tích Dữ Liệu (DS111)
        </h1>
        <p className="text-base text-slate-500 dark:text-slate-400 mt-2 max-w-3xl">
          Hệ thống đánh giá chuyên sâu sử dụng Item Response Theory (IRT) và Kernel Density Estimation (KDE). Các biểu đồ được thiết kế chuẩn khoa học.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="p-6 glass-card border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tổng Số Thí Sinh</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{data.stats.total_students}</h3>
            </div>
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-full text-indigo-600 dark:text-indigo-400">
              <Users size={24} />
            </div>
          </div>
        </Card>
        
        <Card className="p-6 glass-card border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Điểm TB Toán (IRT)</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{data.stats.math_irt.mean}</h3>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-full text-orange-600 dark:text-orange-400">
              <TrendingUp size={24} />
            </div>
          </div>
        </Card>
        
        <Card className="p-6 glass-card border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Điểm TB Khoa học (IRT)</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{data.stats.sci_irt.mean}</h3>
            </div>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-full text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={24} />
            </div>
          </div>
        </Card>
        
        <Card className="p-6 glass-card border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Câu Hỏi Cần Lưu Ý</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{data.flagged.length}</h3>
            </div>
            <div className="p-3 bg-rose-100 dark:bg-rose-900/50 rounded-full text-rose-600 dark:text-rose-400">
              <AlertTriangle size={24} />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Phân loại năng lực (Pie Chart) - Mới */}
        <Card className="p-1 bg-[#f8fafc] dark:bg-slate-900/50 shadow-md border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden xl:col-span-2">
          <Plot
            data={[plotPieMath as any, plotPieSci as any]}
            layout={{
              ...seabornLayout,
              title: { text: 'Tỷ lệ Phân loại Năng lực Thí sinh (Toán & Khoa học)', ...titleFont, y: 0.95 },
              grid: { rows: 1, columns: 2 },
              showlegend: true,
              legend: { orientation: 'h', y: -0.1, x: 0.5, xanchor: 'center', font: { color: isDark ? '#e2e8f0' : '#475569' } },
              margin: { l: 20, r: 20, t: 80, b: 40 },
              annotations: [
                { text: 'Toán', x: 0.225, y: 0.5, font: { size: 16, family: 'Inter', color: isDark ? '#94a3b8' : '#64748b' }, showarrow: false },
                { text: 'Khoa học', x: 0.775, y: 0.5, font: { size: 16, family: 'Inter', color: isDark ? '#94a3b8' : '#64748b' }, showarrow: false }
              ]
            } as any}
            style={{ width: "100%", height: "400px" }}
            useResizeHandler={true}
          />
        </Card>

        {/* KDE Distributions Combined */}
        <Card className="p-1 bg-white dark:bg-slate-900 shadow-md border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden xl:col-span-2">
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
              legend: { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', font: { color: isDark ? '#e2e8f0' : '#475569' } }
            } as any}
            style={{ width: "100%", height: "480px" }}
            useResizeHandler={true}
          />
        </Card>
        
        {/* GAM Curves */}
        <Card className="p-1 bg-white dark:bg-slate-900 shadow-md border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <Plot
            data={[...plotGamMath as any]}
            layout={{
              ...seabornLayout,
              title: { text: 'Đường cong GAM (Môn Toán)', ...subTitleFont },
              xaxis: { ...seabornLayout.xaxis, title: 'Năng lực Theta (-3 đến 3)', range: [-3, 3] },
              yaxis: { ...seabornLayout.yaxis, title: 'Điểm thô (0-300)', range: [0, 300] },
              showlegend: true,
              legend: { ...seabornLayout.legend, font: { color: isDark ? '#e2e8f0' : '#475569' } }
            } as any}
            style={{ width: "100%", height: "420px" }}
            useResizeHandler={true}
          />
        </Card>

        <Card className="p-1 bg-white dark:bg-slate-900 shadow-md border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <Plot
            data={[...plotGamSci as any]}
            layout={{
              ...seabornLayout,
              title: { text: 'Đường cong GAM (Môn Khoa học)', ...subTitleFont },
              xaxis: { ...seabornLayout.xaxis, title: 'Năng lực Theta (-3 đến 3)', range: [-3, 3] },
              yaxis: { ...seabornLayout.yaxis, title: 'Điểm thô (0-300)', range: [0, 300] },
              showlegend: true,
              legend: { ...seabornLayout.legend, font: { color: isDark ? '#e2e8f0' : '#475569' } }
            } as any}
            style={{ width: "100%", height: "420px" }}
            useResizeHandler={true}
          />
        </Card>
        
        {/* Boxplot */}
        <Card className="p-1 bg-[#f8fafc] dark:bg-slate-900/50 shadow-md border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <Plot
            data={[plotBoxMath as any, plotBoxSci as any]}
            layout={{
              ...seabornLayout,
              title: { text: 'Phân tán Tứ phân vị (Boxplot)', ...subTitleFont },
              xaxis: { ...seabornLayout.xaxis, title: 'Môn thi' },
              yaxis: { ...seabornLayout.yaxis, title: 'Điểm số chuẩn hoá (0-300)', range: [0, 300] },
              showlegend: false
            } as any}
            style={{ width: "100%", height: "480px" }}
            useResizeHandler={true}
          />
        </Card>

        {/* Tham số câu hỏi */}
        <Card className="p-1 bg-white dark:bg-slate-900 shadow-md border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <Plot
            data={[plotParamsMath as any, plotParamsSci as any]}
            layout={{
              ...seabornLayout,
              title: { text: 'Tham số Câu hỏi (a vs b)', ...subTitleFont },
              xaxis: { ...seabornLayout.xaxis, title: 'Độ khó (b)' },
              yaxis: { ...seabornLayout.yaxis, title: 'Độ phân biệt (a)' },
              legend: { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', font: { color: isDark ? '#e2e8f0' : '#475569' } }
            } as any}
            style={{ width: "100%", height: "480px" }}
            useResizeHandler={true}
          />
        </Card>

        {/* Math Penalty vs IRT */}
        <Card className="p-1 bg-white dark:bg-slate-900 shadow-md border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <Plot
            data={[plotPenaltyMath as any]}
            layout={{
              ...seabornLayout,
              title: { text: 'Toán: Thưởng phạt vs Điểm chuẩn hóa IRT', ...subTitleFont },
              xaxis: { ...seabornLayout.xaxis, title: 'Điểm thưởng phạt (0-30)' },
              yaxis: { ...seabornLayout.yaxis, title: 'IRT Score (0-300)' },
              showlegend: false
            } as any}
            style={{ width: "100%", height: "480px" }}
            useResizeHandler={true}
          />
        </Card>

        {/* Sci Penalty vs IRT */}
        <Card className="p-1 bg-white dark:bg-slate-900 shadow-md border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <Plot
            data={[plotPenaltySci as any]}
            layout={{
              ...seabornLayout,
              title: { text: 'Khoa học: Thưởng phạt vs Điểm chuẩn hóa IRT', ...subTitleFont },
              xaxis: { ...seabornLayout.xaxis, title: 'Điểm thưởng phạt (0-30)' },
              yaxis: { ...seabornLayout.yaxis, title: 'IRT Score (0-300)' },
              showlegend: false
            } as any}
            style={{ width: "100%", height: "480px" }}
            useResizeHandler={true}
          />
        </Card>
      </div>
      
      {/* Leaderboard Table */}
      <Card className="mt-8 bg-white dark:bg-slate-900/70 shadow-md border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden p-6 glass-card">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 font-['Inter']">Bảng Xếp Hạng Năng Lực (Top 10 Thí Sinh)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <th className="p-3">Hạng</th>
                <th className="p-3">Họ và Tên</th>
                <th className="p-3 text-right">Toán (IRT)</th>
                <th className="p-3 text-right">Khoa học (IRT)</th>
                <th className="p-3 text-right">Tổng điểm</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.map((student: any) => (
                <tr key={student.rank} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                    {student.rank === 1 ? '🥇 1' : student.rank === 2 ? '🥈 2' : student.rank === 3 ? '🥉 3' : student.rank}
                  </td>
                  <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{student.name}</td>
                  <td className="p-3 text-right text-orange-600 dark:text-orange-400 font-semibold">{student.math_irt}</td>
                  <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{student.sci_irt}</td>
                  <td className="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{student.total_irt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Descriptive Stats Table */}
      <Card className="mt-8 bg-white dark:bg-slate-900/70 shadow-md border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden p-6 glass-card">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 font-['Inter']">Bảng Thống kê Mô tả Tổng quan</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <th className="p-3">Chỉ số</th>
                <th className="p-3 text-right">Toán (Thô)</th>
                <th className="p-3 text-right">Khoa học (Thô)</th>
                <th className="p-3 text-right text-orange-600 dark:text-orange-400">Toán (IRT)</th>
                <th className="p-3 text-right text-emerald-600 dark:text-emerald-400">Khoa học (IRT)</th>
              </tr>
            </thead>
            <tbody>
              {['Mean', 'Median', 'SD', 'Min', 'Max'].map((metric) => (
                <tr key={metric} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                    {metric === 'Mean' ? 'Điểm Trung bình' : metric === 'Median' ? 'Trung vị' : metric === 'SD' ? 'Độ lệch chuẩn' : metric === 'Min' ? 'Thấp nhất' : 'Cao nhất'}
                  </td>
                  <td className="p-3 text-right text-slate-700 dark:text-slate-300">{data.stats.math_raw[metric.toLowerCase()]}</td>
                  <td className="p-3 text-right text-slate-700 dark:text-slate-300">{data.stats.sci_raw[metric.toLowerCase()]}</td>
                  <td className="p-3 text-right text-orange-600 dark:text-orange-400 font-semibold">{data.stats.math_irt[metric.toLowerCase()]}</td>
                  <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{data.stats.sci_irt[metric.toLowerCase()]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Flagged Items Table */}
      <Card className="mt-8 bg-white dark:bg-slate-900/70 shadow-md border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden p-6 glass-card">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 font-['Inter'] flex items-center gap-2">
          <AlertTriangle className="text-rose-500" size={24} /> Bảng Cảnh báo Câu hỏi (Misfit Items)
        </h2>
        <div className="overflow-x-auto">
          {data.flagged.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <th className="p-3">Câu hỏi</th>
                  <th className="p-3">Môn thi</th>
                  <th className="p-3 text-right">Độ phân biệt (a)</th>
                  <th className="p-3 text-right">Độ khó (b)</th>
                  <th className="p-3">Lý do cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {data.flagged.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-bold text-slate-700 dark:text-slate-300">Câu {item.question}</td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${item.subject === 'Toán' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                        {item.subject}
                      </span>
                    </td>
                    <td className={`p-3 text-right font-semibold ${item.a < 0.5 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>{item.a}</td>
                    <td className={`p-3 text-right font-semibold ${(item.b > 3 || item.b < -3) ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>{item.b}</td>
                    <td className="p-3 text-rose-600 dark:text-rose-400 font-medium">
                      <ul className="list-disc pl-4">
                        {item.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <Target className="mx-auto mb-3 text-emerald-500" size={32} />
              <p>Tuyệt vời! Không có câu hỏi nào bị cảnh báo về chất lượng.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
