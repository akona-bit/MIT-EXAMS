import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMatrices, deleteMatrix } from '../../api/matrix';
import type { Matrix } from '../../types';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Button from '../../components/ui/Button';

export default function MatrixPage() {
  const navigate = useNavigate();
  const [matrices, setMatrices] = useState<Matrix[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    if (!confirm('Bạn có chắc chắn muốn xóa ma trận này? Các đề thi đã tạo từ ma trận có thể bị ảnh hưởng.')) return;
    try {
      await deleteMatrix(id);
      fetchMatrices();
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra khi xóa ma trận.');
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
      key: 'actions',
      header: 'Thao tác',
      width: '120px',
      render: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/matrix/${row.id}/edit`)}>Sửa</Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(row.id)}>Xóa</Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">Ma trận Đặc tả</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Quản lý cấu trúc đề thi</p>
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
          />
        </div>
      </div>
    </div>
  );
}
