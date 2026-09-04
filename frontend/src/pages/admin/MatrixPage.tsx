import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMatrices, deleteMatrix } from '../../api/matrix';
import type { Matrix } from '../../types';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Eye, Pencil, Trash2, Sparkles, LayoutGrid } from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export default function MatrixPage() {
  const navigate = useNavigate();
  const [matrices, setMatrices] = useState<Matrix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchMatrices = async () => {
    setIsLoading(true);
    try {
      const data = await getMatrices(0, 50);
      setMatrices(data.items);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrices();
  }, []);

  const handleDelete = async (id: number) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteMatrix(deleteId);
      fetchMatrices();
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra khi xóa ma trận.');
    } finally {
      setConfirmOpen(false);
      setDeleteId(null);
    }
  };

  const columns: Column<Matrix>[] = [
    { key: 'id', header: 'ID', width: '80px' },
    { key: 'name', header: 'Tên ma trận' },
    { 
      key: 'description', 
      header: 'Mô tả',
      render: (row) => <div className="truncate max-w-sm">{row.description}</div>
    },
    {
      key: 'rules',
      header: 'Số ô',
      width: '80px',
      render: (row) => <span className="font-mono text-sm">{row.rules?.length || 0}</span>
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '200px',
      render: (row) => (
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/matrix/${row.id}`)} className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Xem
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/matrix/${row.id}/edit`)} className="flex items-center gap-1">
            <Pencil className="w-3.5 h-3.5" /> Sửa
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(row.id)} className="flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient flex items-center gap-3 pb-1">
            <LayoutGrid className="w-8 h-8 text-primary-500" />
            Ma trận Đặc tả
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Quản lý cấu trúc đề thi</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => navigate('/admin/matrix/new?smart=1')}>
            <Sparkles className="w-4 h-4 mr-1.5" /> Smart Builder
          </Button>
          <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary-500/30 hover:-translate-y-0.5" onClick={() => navigate('/admin/matrix/new')}>
            + Thêm ma trận
          </Button>
        </div>
      </div>

      <div className="p-0 overflow-hidden glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-2xl">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Danh sách Ma trận</h2>
          </div>
          <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary-500/30 hover:-translate-y-0.5" onClick={() => navigate('/admin/matrix/new')}>
            + Thêm ma trận
          </Button>
        </div>

        <div className="p-6">
          <DataTable 
            data={matrices}
            columns={columns}
            keyExtractor={(item) => item.id}
            isLoading={isLoading}
            emptyMessage="Chưa có ma trận đặc tả nào"
          />
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Xóa ma trận"
        message="Bạn có chắc chắn muốn xóa ma trận này? Các đề thi đã tạo từ ma trận có thể bị ảnh hưởng."
        confirmText="Xóa"
        cancelText="Hủy"
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => { setConfirmOpen(false); setDeleteId(null); }}
      />
    </div>
  );
}
