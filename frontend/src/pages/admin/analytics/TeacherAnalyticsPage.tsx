import { useState, useEffect, useMemo } from "react";
import { Users, BarChart3, Database } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import DataTable from "../../../components/ui/DataTable";

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
        fetch("http://localhost:8000/api/v1/analytics/class-summary"),
        fetch("http://localhost:8000/api/v1/analytics/item-analysis")
      ]);
      const summary = await resSummary.json();
      const items = await resItems.json();
      setClassSummary(summary);
      setItemAnalysis(items.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = useMemo(() => [
    {
      header: "Câu hỏi",
      key: "question",
      render: (row: any) => <span className="font-medium">{row.question}</span>
    },
    {
      header: "Tỷ lệ đúng",
      key: "correct_percent",
      render: (row: any) => (
        <Badge variant={row.correct_percent > 70 ? "success" : row.correct_percent > 30 ? "warning" : "destructive"}>
          {row.correct_percent}%
        </Badge>
      )
    },
    {
      header: "Tỷ lệ sai",
      key: "wrong_percent",
      render: (row: any) => <span className="text-slate-600">{row.wrong_percent}%</span>
    },
    {
      header: "Bỏ trống",
      key: "empty_percent",
      render: (row: any) => <span className="text-slate-400">{row.empty_percent}%</span>
    },
    {
      header: "Số HS Đúng",
      key: "correct_count"
    },
    {
      header: "Số HS Sai/Trống",
      key: "wrong_count",
      render: (row: any) => row.wrong_count + row.empty_count
    }
  ], []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Thống Kê Lớp Học</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Tổng quan điểm số và phân tích độ khó câu hỏi
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-6 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
            <Users className="h-7 w-7 text-indigo-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Tổng số thí sinh</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{classSummary?.total_students || 0}</p>
          </div>
        </Card>

        <Card className="p-6 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-500/10">
            <BarChart3 className="h-7 w-7 text-primary-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Trung bình Toán (IRT)</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{classSummary?.avg_toan || 0}</p>
          </div>
        </Card>

        <Card className="p-6 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-success-50 dark:bg-success-500/10">
            <Database className="h-7 w-7 text-success-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Trung bình TDKH (IRT)</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{classSummary?.avg_tdkh || 0}</p>
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Phân Tích Câu Hỏi (Item Analysis)</h2>
          <p className="text-sm text-slate-500 mt-1">Phân tích mức độ khó của 60 câu hỏi dựa trên tỷ lệ làm đúng.</p>
        </div>
        <div className="p-6">
          <DataTable 
            data={itemAnalysis} 
            columns={columns}
            keyExtractor={(item: any) => item.question}
            isLoading={isLoading}
            emptyMessage="Chưa có dữ liệu phân tích câu hỏi."
          />
        </div>
      </Card>
    </div>
  );
}
