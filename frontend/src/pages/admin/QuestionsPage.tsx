import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getQuestions, deleteQuestion } from "../../api/questions";
import type { Question } from "../../types";
import DataTable, { type Column } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { Plus, Search, Edit3, Trash2, HelpCircle } from "lucide-react";

export default function QuestionsPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const data = await getQuestions(0, 50);
      setQuestions(data.items);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteQuestion(deleteId);
      await fetchQuestions();
    } catch (error) {
      console.error(error);
    } finally {
      setDeleteId(null);
    }
  };

  const columns: Column<Question>[] = [
    { key: "id", header: "ID", width: "80px", render: (row) => <span className="font-mono text-xs text-slate-500">#{row.id}</span> },
    {
      key: "content",
      header: "Nội dung",
      render: (row) => (
        <div className="flex items-center gap-3 max-w-md">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-500/10">
            <HelpCircle className="h-4 w-4 text-primary-500" />
          </div>
          <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100" title={row.content}>
            {row.content}
          </div>
        </div>
      ),
    },
    {
      key: "level",
      header: "Mức độ",
      render: (row) => {
        const labels: Record<number, string> = {
          1: "Nhận biết",
          2: "Thông hiểu",
          3: "Vận dụng",
          4: "Vận dụng cao",
        };
        const variants: Record<number, any> = {
          1: "info",
          2: "success",
          3: "warning",
          4: "destructive",
        };
        return <Badge variant={variants[row.level] || "secondary"}>{labels[row.level] || `Mức ${row.level}`}</Badge>;
      },
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (row) => {
        const variants: Record<string, any> = {
          DRAFT: "secondary",
          APPROVED: "success",
          REJECTED: "destructive",
        };
        return <Badge variant={variants[row.status] || "secondary"}>{row.status}</Badge>;
      },
    },
    {
      key: "actions",
      header: "Thao tác",
      width: "140px",
      render: (row) => (
        <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Chỉnh sửa"
            onClick={() => navigate(`/admin/questions/${row.id}/edit`)}
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-danger-500 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/10"
            title="Xóa"
            onClick={() => setDeleteId(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Ngân hàng Câu hỏi
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý và cập nhật câu hỏi cho các kỳ thi
          </p>
        </div>
      </div>

      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm câu hỏi..." 
            className="h-11 w-full rounded-xl border border-slate-200/60 bg-slate-50/50 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-white/10 dark:bg-slate-950/50 dark:focus:border-primary-500"
          />
        </div>
        <Link to="/admin/questions/new" className="shrink-0">
          <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary-500/20">
            <Plus className="mr-2 h-5 w-5" />
            Thêm câu hỏi
          </Button>
        </Link>
      </div>

      <DataTable
        data={questions}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyMessage="Chưa có câu hỏi nào trong ngân hàng."
      />

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Xác nhận xóa"
        message={
          <p className="text-slate-500 dark:text-slate-400">
            Bạn có chắc chắn muốn xóa câu hỏi này? Hành động này không thể hoàn tác.
          </p>
        }
        isDestructive={true}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
