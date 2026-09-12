import { useAuth } from "../../stores/authStore";
import { useQuery } from "@tanstack/react-query";
import { getDashboardOverview } from "../../api/statistics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { motion } from "framer-motion";
import { BookOpen, Users, FileText, CheckCircle2, TrendingUp, Calendar, PlusCircle, ListPlus, FolderPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

function formatExamTime(startTime: string | null, endTime: string | null) {
  if (!startTime && !endTime) return "Chưa đặt lịch";
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (startTime && endTime) {
    return `${formatter.format(new Date(startTime))} - ${formatter.format(new Date(endTime))}`;
  }
  return formatter.format(new Date(startTime || endTime || ""));
}

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "secondary" }> = {
  DRAFT: { label: "Bản nháp", variant: "secondary" },
  PUBLISHED: { label: "Đang mở", variant: "success" },
  COMPLETED: { label: "Hoàn tất", variant: "default" },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const overviewQuery = useQuery({
    queryKey: ["dashboardOverview"],
    queryFn: getDashboardOverview,
  });
  
  const overview = overviewQuery.data;
  
  const stats = overview
    ? [
        {
          label: "Tổng câu hỏi",
          value: overview.total_questions,
          icon: BookOpen,
          color: "text-primary-500",
          bg: "bg-primary-500/10",
        },
        {
          label: "Kỳ thi đã tạo",
          value: overview.total_exams,
          icon: FileText,
          color: "text-indigo-500",
          bg: "bg-indigo-500/10",
        },
        {
          label: "Thí sinh",
          value: overview.total_participants,
          icon: Users,
          color: "text-warning-500",
          bg: "bg-warning-500/10",
        },
        {
          label: "Bài đã nộp",
          value: overview.total_submissions,
          icon: CheckCircle2,
          color: "text-emerald-500",
          bg: "bg-emerald-500/10",
        },
      ]
    : [];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  const formattedChartData = overview?.score_distribution.map(item => ({
    name: item.range.split("-")[0],
    count: item.count,
    fullRange: item.range
  })) || [];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient pb-1">
            Chào mừng trở lại, {user?.username || "Admin"}
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi tổng quan chất lượng bài thi và thống kê tương tác
          </p>
        </div>
        <div className="mt-4 sm:mt-0 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:border-primary-800/50 dark:bg-[#0b1121]/60 dark:text-primary-100 shadow-[0_0_20px_-5px_rgba(30,58,138,0.2)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          Hệ thống đang hoạt động
        </div>
      </div>

      {overviewQuery.isError && (
        <div role="alert" className="rounded-xl border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          Không thể tải dữ liệu dashboard.
        </div>
      )}

      {/* Stats Cards */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {overviewQuery.isLoading
          ? [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32 rounded-2xl" />)
          : stats.map((stat) => (
              <motion.div key={stat.label} variants={itemAnim}>
                <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200 dark:hover:shadow-[0_0_30px_-5px_rgba(30,58,138,0.3)] hover:-translate-y-1 shadow-lg border border-slate-200 dark:border-primary-900/50 dark:bg-[#0b1121]/60">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-primary-500/5 dark:to-transparent" />
                  <CardContent className="relative p-6">
                    <div className="flex items-center justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.bg} ${stat.color} ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                        <stat.icon className="h-6 w-6" strokeWidth={2} />
                      </div>
                      <TrendingUp className="h-4 w-4 text-slate-300 dark:text-slate-700" />
                    </div>
                    <div className="mt-4">
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                      <h3 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {stat.value.toLocaleString("vi-VN")}
                      </h3>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Score Distribution Chart */}
        <Card className="lg:col-span-2 flex flex-col shadow-lg border border-slate-200 dark:border-primary-900/50 dark:bg-[#0b1121]/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Phổ điểm tổng quan</CardTitle>
                <CardDescription>Biểu đồ phân bố điểm tổng (0-1200)</CardDescription>
              </div>
              <Badge variant="outline" className="hidden sm:inline-flex bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800">
                Real-time
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {overviewQuery.isLoading ? (
              <Skeleton className="h-[300px] w-full rounded-xl" />
            ) : overview?.score_distribution.some((item) => item.count > 0) ? (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                    />
                    <RechartsTooltip 
                      cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-primary-800 dark:bg-slate-900">
                              <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">
                                Khoảng điểm: {data.fullRange}
                              </p>
                              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                                Số lượng: <span className="font-medium text-slate-900 dark:text-white">{data.count} bài</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="count" 
                      radius={[4, 4, 0, 0]} 
                      animationDuration={1500} 
                      animationEasing="ease-out"
                    >
                      {formattedChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.count > 0 ? "url(#colorCount)" : "#e2e8f0"} />
                      ))}
                    </Bar>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2D6CFF" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="#7FA8FF" stopOpacity={0.7}/>
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 dark:border-primary-800/50 dark:bg-[#0b1121]/40">
                <div className="rounded-full bg-slate-100 p-4 dark:bg-primary-900/30 mb-3 shadow-inner">
                  <TrendingUp className="h-8 w-8 text-slate-400 dark:text-primary-500/70" />
                </div>
                <p className="text-base font-semibold text-slate-600 dark:text-slate-300">Chưa có dữ liệu điểm</p>
                <p className="text-sm text-slate-500 mt-1">Đợi thí sinh nộp bài để xem phổ điểm</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column Stack */}
        <div className="flex flex-col gap-6">
          {/* Quick Actions */}
          <Card className="flex flex-col shadow-lg border border-slate-200 dark:border-primary-900/50 dark:bg-[#0b1121]/60">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-emerald-500" />
                <CardTitle>Thao tác nhanh</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3">
                <Link to="/admin/exams/new">
                  <div className="group flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-emerald-500 hover:bg-emerald-50 dark:border-primary-800 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-900/20 transition-all cursor-pointer">
                    <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                      <PlusCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">Tạo kỳ thi mới</p>
                    </div>
                  </div>
                </Link>
                <Link to="/admin/questions/new">
                  <div className="group flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-primary-500 hover:bg-primary-50 dark:border-primary-800 dark:hover:border-primary-500/50 dark:hover:bg-primary-900/20 transition-all cursor-pointer">
                    <div className="rounded-full bg-primary-100 p-2 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400 group-hover:scale-110 transition-transform">
                      <ListPlus className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-primary-700 dark:group-hover:text-primary-300">Thêm câu hỏi</p>
                    </div>
                  </div>
                </Link>
                <Link to="/admin/matrix/new">
                  <div className="group flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-warning-500 hover:bg-warning-50 dark:border-primary-800 dark:hover:border-warning-500/50 dark:hover:bg-warning-900/20 transition-all cursor-pointer">
                    <div className="rounded-full bg-warning-100 p-2 text-warning-600 dark:bg-warning-900/50 dark:text-warning-400 group-hover:scale-110 transition-transform">
                      <FolderPlus className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-warning-700 dark:group-hover:text-warning-300">Tạo ma trận đề</p>
                    </div>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Recent Exams */}
          <Card className="flex flex-col shadow-lg border border-slate-200 dark:border-primary-900/50 dark:bg-[#0b1121]/60 flex-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-500" />
                  <CardTitle>Kỳ thi gần đây</CardTitle>
                </div>
                <Link to="/admin/exams" className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
                  Xem tất cả &rarr;
                </Link>
              </div>
            </CardHeader>
            <CardContent className="overflow-auto pb-4">
              {overviewQuery.isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="flex gap-4">
                      <Skeleton className="h-10 w-10 rounded-xl" />
                      <div className="flex-1 space-y-2 py-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : overview?.recent_exams.length ? (
                <div className="space-y-3 pr-2">
                  {overview.recent_exams.map((exam, i) => {
                    const conf = statusConfig[exam.status] || { label: exam.status, variant: "secondary" };
                    return (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={exam.id}
                      >
                        <Link to={`/admin/exams/${exam.id}`}>
                          <div className="group flex items-start gap-3 rounded-xl border border-transparent p-2 transition-colors hover:bg-slate-50 dark:hover:bg-primary-900/20 hover:border-slate-200 dark:hover:border-primary-800/50 cursor-pointer">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 group-hover:bg-indigo-100 transition-colors">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                {exam.name}
                              </h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {formatExamTime(exam.start_time, exam.end_time)}
                              </p>
                              <div className="mt-1.5">
                                <Badge variant={conf.variant} className="text-[10px] px-1.5 py-0">
                                  {conf.label}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-32 flex-col items-center justify-center text-center">
                  <FileText className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Chưa có kỳ thi nào</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
