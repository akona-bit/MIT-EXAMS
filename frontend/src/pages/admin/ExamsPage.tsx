import { useState, useEffect } from "react";
import { getExams } from "../../api/exams";
import type { Exam } from "../../types";
import DataTable, { type Column } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Link } from "react-router-dom";
import { Plus, Search, FileText } from "lucide-react";

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Quản lý Kỳ thi
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tạo, xuất bản và theo dõi các kỳ thi trắc nghiệm
          </p>
        </div>
      </div>

      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm kỳ thi..." 
            className="h-11 w-full rounded-xl border border-slate-200/60 bg-slate-50/50 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-white/10 dark:bg-slate-950/50 dark:focus:border-primary-500"
          />
        </div>
        <Link to="/admin/exams/new" className="shrink-0">
          <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary-500/20">
            <Plus className="mr-2 h-5 w-5" />
            Tạo kỳ thi
          </Button>
        </Link>
      </div>

      <DataTable
        data={exams}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyMessage="Chưa có kỳ thi nào được tạo."
      />
    </div>
  );
}
