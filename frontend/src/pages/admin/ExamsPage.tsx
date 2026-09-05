import { useState, useEffect } from "react";
import { getExams, deleteExam } from "../../api/exams";
import type { Exam } from "../../types";
import DataTable, { type Column } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { Link } from "react-router-dom";
import { Plus, Search, FileText, BarChart2, Trash2 } from "lucide-react";
import { PageTransition } from "../../components/ui/PageTransition";
import { toast } from "../../components/ui/Toast";

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteExam(deleteId);
      toast.success("Đã xóa kỳ thi thành công");
      await fetchExams();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Không thể xóa kỳ thi");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const filteredExams = search
    ? exams.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : exams;

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
    { key: "duration_minutes", header: "Thời gian (phút)", render: (row) => row.duration_minutes !== null ? `${row.duration_minutes} phút` : "Không giới hạn" },
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
      width: "150px",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Link to={`/admin/exams/${row.id}`}>
            <Button variant="outline" size="sm" className="h-8">
              Chi tiết
            </Button>
          </Link>
          {row.status !== "PUBLISHED" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-danger-500 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/10"
              title="Xóa kỳ thi"
              onClick={() => setDeleteId(row.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3 pb-1">
            <FileText className="w-7 h-7 text-primary-600" />
            Kỳ thi
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Quản lý các đợt thi, theo dõi trạng thái và cấu hình
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/admin/analytics/ds">
            <Button variant="outline" className="shadow-sm">
              <BarChart2 className="mr-2 h-4 w-4 text-indigo-500" />
              So sánh Kỳ thi
            </Button>
          </Link>
          <Link to="/admin/exams/new">
            <Button className="shadow-lg shadow-primary-500/30">
              <Plus className="mr-2 h-4 w-4" />
              Tạo kỳ thi mới
            </Button>
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm kỳ thi..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
            data={filteredExams}
            columns={columns}
            keyExtractor={(item) => item.id}
            isLoading={isLoading}
            emptyMessage="Chưa có kỳ thi nào được tạo."
          />
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Xóa kỳ thi"
        message="Bạn có chắc chắn muốn xóa kỳ thi này? Hành động này sẽ xóa tất cả mã đề, câu hỏi liên kết và dữ liệu thí sinh. Không thể hoàn tác."
        confirmText="Xóa kỳ thi"
        cancelText="Hủy bỏ"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isDeleting}
        isDestructive
      />
    </PageTransition>
  );
}
