import { useState, useEffect } from 'react';
import { getMatrices } from '../../api/matrix';
import type { Matrix } from '../../types';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Button from '../../components/ui/Button';

export default function MatrixPage() {
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
      render: () => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">Sửa</Button>
          <Button variant="danger" size="sm">Xóa</Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Ma trận Đặc tả</h1>
          <p className="text-sm text-neutral-500 mt-1">Quản lý cấu trúc đề thi</p>
        </div>
        <Button onClick={() => alert('Feature in development')}>+ Thêm ma trận</Button>
      </div>

      <DataTable 
        data={matrices}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
      />
    </div>
  );
}
