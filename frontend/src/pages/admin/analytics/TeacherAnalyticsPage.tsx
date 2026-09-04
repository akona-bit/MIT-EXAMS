import { useState, useEffect, useMemo } from "react";
import { Users, BarChart3, Database } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import DataTable from "../../../components/ui/DataTable";
import { motion } from "framer-motion";
import client from "../../../api/client";

export default function TeacherAnalyticsPage() {
  const [classSummary, setClassSummary] = useState<any>(null);
  const [itemAnalysis, setItemAnalysis] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resSummary, resItems] = await Promise.all([
        client.get("/api/v1/analytics/class-summary"),
        client.get("/api/v1/analytics/item-analysis"),
      ]);
      const summary = resSummary.data;
      const items = resItems.data;
      setClassSummary(summary);
      setItemAnalysis(items.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        header: "Câu hỏi",
        key: "question",
        render: (row: any) => (
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {row.question}
          </span>
        ),
      },
      {
        header: "Tỷ lệ đúng",
        key: "correct_percent",
        render: (row: any) => (
          <Badge
            variant={
              row.correct_percent > 70
                ? "success"
                : row.correct_percent > 30
                  ? "warning"
                  : "destructive"
            }
            className="shadow-sm"
          >
            {row.correct_percent}%
          </Badge>
        ),
      },
      {
        header: "Tỷ lệ sai",
        key: "wrong_percent",
        render: (row: any) => (
          <span className="text-danger-500 font-medium">
            {row.wrong_percent}%
          </span>
        ),
      },
      {
        header: "Bỏ trống",
        key: "empty_percent",
        render: (row: any) => (
          <span className="text-slate-400 font-medium">
            {row.empty_percent}%
          </span>
        ),
      },
      {
        header: "Số HS Đúng",
        key: "correct_count",
        render: (row: any) => (
          <span className="text-success-600 dark:text-success-500 font-bold">
            {row.correct_count}
          </span>
        ),
      },
      {
        header: "Số HS Sai/Trống",
        key: "wrong_count",
        render: (row: any) => (
          <span className="text-orange-600 dark:text-orange-500 font-bold">
            {row.wrong_count + row.empty_count}
          </span>
        ),
      },
    ],
    [],
  );

  const containerAnim = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 },
    },
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Skeleton className="h-36 rounded-3xl" />
          <Skeleton className="h-36 rounded-3xl" />
          <Skeleton className="h-36 rounded-3xl" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200/60 dark:border-slate-800/60 pb-6">
        <h1 className="text-3xl font-extrabold text-gradient pb-1 tracking-tight">
          Thống Kê Lớp Học
        </h1>
        <p className="text-base font-medium text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
          Phân tích phổ điểm tổng quan và độ phân biệt của từng câu hỏi theo
          chuẩn khảo thí.
        </p>
      </div>

      <motion.div
        variants={containerAnim}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-3 gap-6"
      >
        <motion.div variants={itemAnim}>
          <Card className="relative overflow-hidden group glass-card hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 border border-white/50 dark:border-white/10 p-6 rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-500/10 pointer-events-none" />
            <div className="relative flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform">
                <Users className="h-8 w-8" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Tổng thí sinh
                </p>
                <p className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {classSummary?.total_students || 0}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemAnim}>
          <Card className="relative overflow-hidden group glass-card hover:shadow-xl hover:shadow-primary-500/10 hover:-translate-y-1 transition-all duration-300 border border-white/50 dark:border-white/10 p-6 rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-50/50 to-transparent dark:from-primary-500/10 pointer-events-none" />
            <div className="relative flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 shadow-inner group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                <BarChart3 className="h-8 w-8" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Trung bình Toán (IRT)
                </p>
                <p className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {classSummary?.avg_toan || 0}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemAnim}>
          <Card className="relative overflow-hidden group glass-card hover:shadow-xl hover:shadow-success-500/10 hover:-translate-y-1 transition-all duration-300 border border-white/50 dark:border-white/10 p-6 rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-success-50/50 to-transparent dark:from-success-500/10 pointer-events-none" />
            <div className="relative flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-success-100 dark:bg-success-500/20 text-success-600 dark:text-success-400 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform">
                <Database className="h-8 w-8" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Trung bình TDKH (IRT)
                </p>
                <p className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {classSummary?.avg_tdkh || 0}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <Card className="p-0 overflow-hidden glass-card shadow-2xl shadow-slate-200/50 dark:shadow-none border border-white/60 dark:border-white/10 rounded-3xl relative">
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
          <div className="relative p-6 sm:p-8 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Phân Tích Chi Tiết Từng Câu Hỏi
              </h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                Hỗ trợ nhận diện câu hỏi quá khó hoặc có tính phân loại kém.
              </p>
            </div>
            <Badge
              variant="outline"
              className="self-start sm:self-center px-4 py-1 text-sm bg-white/50 dark:bg-slate-800/50 backdrop-blur-md"
            >
              Cập nhật trực tiếp
            </Badge>
          </div>
          <div className="relative p-6 sm:p-8 bg-slate-50/30 dark:bg-slate-900/20">
            <DataTable
              data={itemAnalysis}
              columns={columns}
              keyExtractor={(item: any) => item.question}
              isLoading={isLoading}
              emptyMessage="Chưa có dữ liệu phân tích câu hỏi."
            />
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
