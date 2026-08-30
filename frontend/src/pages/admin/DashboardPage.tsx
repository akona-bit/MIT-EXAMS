import { useAuth } from "../../stores/authStore";
import { useQuery } from "@tanstack/react-query";
import { getDashboardOverview } from "../../api/statistics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { motion } from "framer-motion";
import { BookOpen, Users, FileText, CheckCircle2, TrendingUp, Calendar } from "lucide-react";

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
  const maxScoreCount = Math.max(
    ...(overview?.score_distribution.map((item) => item.count) ?? [0]),
    1,
  );
  
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient pb-1">
            Chào mừng trở lại, {user?.username || "Admin"}
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi tổng quan chất lượng bài thi và thống kê tương tác
          </p>
        </div>
        <div className="mt-4 sm:mt-0 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300 shadow-sm backdrop-blur-md">
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
                <Card className="group relative overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none hover:-translate-y-1 glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5" />
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
        <Card className="lg:col-span-2 flex flex-col glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Phổ điểm tổng quan</CardTitle>
                <CardDescription>Biểu đồ phân bố điểm theo thang IRT (0-300)</CardDescription>
              </div>
              <Badge variant="outline" className="hidden sm:inline-flex">Real-time</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            {overviewQuery.isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : overview?.score_distribution.some((item) => item.count > 0) ? (
              <div className="flex h-64 items-end gap-1.5 sm:gap-2 px-1">
                {overview.score_distribution.map((item, i) => (
                  <div key={item.range} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                    {/* Tooltip */}
                    <div className="absolute -top-10 scale-0 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 z-10 pointer-events-none">
                      <div className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-xl">
                        {item.count} bài
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                      </div>
                    </div>
                    
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max((item.count / maxScoreCount) * 100, item.count ? 4 : 1)}%` }}
                      transition={{ duration: 0.8, delay: i * 0.05, type: "spring" }}
                      className="w-full rounded-t-md bg-gradient-to-t from-primary-600/80 to-primary-400 hover:brightness-110 cursor-pointer shadow-sm relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20" />
                    </motion.div>
                    <span className="mt-3 text-[10px] font-medium text-slate-500 rotate-[-45deg] origin-top-left sm:rotate-0 sm:origin-center">
                      {item.range.split("-")[0]}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-800 mb-3">
                  <TrendingUp className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Chưa có dữ liệu điểm</p>
                <p className="text-xs text-slate-500 mt-1">Đợi thí sinh nộp bài để xem phổ điểm</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Exams */}
        <Card className="flex flex-col glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-500" />
              <CardTitle>Kỳ thi gần đây</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
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
              <div className="space-y-4 pr-2">
                {overview.recent_exams.map((exam, i) => {
                  const conf = statusConfig[exam.status] || { label: exam.status, variant: "secondary" };
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      key={exam.id}
                      className="group flex items-start gap-4 rounded-xl border border-transparent p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:border-slate-100 dark:hover:border-slate-800"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                        <FileText className="h-5 w-5 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 transition-colors">
                          {exam.name}
                        </h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatExamTime(exam.start_time, exam.end_time)}
                        </p>
                        <div className="mt-2">
                          <Badge variant={conf.variant}>{conf.label}</Badge>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center text-center">
                <FileText className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Chưa có kỳ thi nào</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Hãy tạo một kỳ thi mới để bắt đầu theo dõi tiến độ.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
