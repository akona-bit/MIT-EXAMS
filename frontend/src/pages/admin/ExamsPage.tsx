import { useState, useEffect } from "react";
import { getExams } from "../../api/exams";
import type { Exam } from "../../types";
import DataTable, { type Column } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Link } from "react-router-dom";
import { Plus, Search, FileText, BarChart2 } from "lucide-react";

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchExams = async () => {
    setIsLoading(true);
    try {
      const data = await getExams();
      setExams(data.items);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const columns: Column<Exam>[] = [
    { key: "id", header: "ID", width: "80px", render: (row) => <span className="font-mono text-xs text-slate-500">#{row.id}</span> },
    { 
      key: "name", 
      header: "Tên kỳ thi",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
            <FileText className="h-4 w-4 text-indigo-500" />
          </div>
          <span className="font-medium text-slate-900 dark:text-slate-100">{row.name}</span>
        </div>
      )
    },
    { key: "duration_minutes", header: "Thời gian (phút)", render: (row) => `${row.duration_minutes} phút` },
    {
      key: "status",
      header: "Trạng thái",
      render: (row) => {
        const variants: Record<string, any> = {
          DRAFT: "secondary",
          PUBLISHED: "success",
          FINISHED: "default",
        };
        const labels: Record<string, string> = {
          DRAFT: "Bản nháp",
          PUBLISHED: "Đang diễn ra",
          FINISHED: "Đã kết thúc",
        };
        return <Badge variant={variants[row.status] || "secondary"}>{labels[row.status] || row.status}</Badge>;
      },
    },
    {
      key: "actions",
      header: "Thao tác",
      width: "120px",
      render: (row) => (
        <Link to={`/admin/exams/${row.id}`}>
          <Button variant="outline" size="sm" className="h-8">
            Chi tiết
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">Kỳ thi</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Quản lý các đợt thi, theo dõi trạng thái và cấu hình
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/exams/compare"
            className="inline-flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200"
          >
            <BarChart2 className="mr-2 h-4 w-4 text-indigo-500" />
            So sánh Kỳ thi
          </Link>
          <Link
            to="/admin/exams/new"
            className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 hover:bg-primary-500 transition-all duration-200"
          >
            <Plus className="mr-2 h-4 w-4" />
            Tạo kỳ thi mới
          </Link>
        </div>
      </div>

      <div className="p-0 overflow-hidden glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-2xl">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm kỳ thi..." 
              className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <Link to="/admin/exams/new" className="shrink-0">
            <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary-500/30 hover:-translate-y-0.5">
              <Plus className="mr-2 h-5 w-5" />
              Tạo kỳ thi
            </Button>
          </Link>
        </div>

        <div className="p-6">
          <DataTable
            data={exams}
            columns={columns}
            keyExtractor={(item) => item.id}
            isLoading={isLoading}
            emptyMessage="Chưa có kỳ thi nào được tạo."
          />
        </div>
      </div>
    </div>
  );
}
