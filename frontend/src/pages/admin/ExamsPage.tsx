import { useState, useEffect } from 'react';
import { getExams } from '../../api/exams';
import type { Exam } from '../../types';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Button from '../../components/ui/Button';
import { Link } from 'react-router-dom';

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
    { key: 'id', header: 'ID', width: '80px' },
    { key: 'name', header: 'Tên kỳ thi' },
    { key: 'duration_minutes', header: 'Thời gian (phút)' },
    { 
      key: 'status', 
      header: 'Trạng thái',
      render: (row) => {
        const colors: Record<string, string> = {
          'DRAFT': 'bg-gray-100 text-gray-800',
          'PUBLISHED': 'bg-primary-500/10 text-primary-500',
          'FINISHED': 'bg-success-500/10 text-success-500',
        };
        const color = colors[row.status] || 'bg-gray-100 text-gray-800';
        return <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${color}`}>{row.status}</span>;
      }
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '120px',
      render: (row) => (
        <Link to={`/admin/exams/${row.id}`}>
          <Button variant="secondary" size="sm">Chi tiết</Button>
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Quản lý Kỳ thi</h1>
          <p className="text-sm text-neutral-500 mt-1">Tạo và xuất bản kỳ thi trắc nghiệm</p>
        </div>
        <Button onClick={() => alert('Feature in development')}>+ Tạo kỳ thi</Button>
      </div>

      <DataTable 
        data={exams}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
      />
    </div>
  );
}
