import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getQuestions, deleteQuestion } from '../../api/questions';
import type { Question } from '../../types';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

export default function QuestionsPage() {
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
    { key: 'id', header: 'ID', width: '80px' },
    { 
      key: 'content', 
      header: 'Nội dung',
      render: (row) => (
        <div className="truncate max-w-md" title={row.content}>
          {row.content}
        </div>
      )
    },
    { 
      key: 'level',
      header: 'Mức độ',
      render: (row) => {
        const labels: Record<number, string> = {
          1: 'Nhận biết',
          2: 'Thông hiểu',
          3: 'Vận dụng',
          4: 'Vận dụng cao',
        };
        const colors: Record<number, string> = {
          1: 'bg-blue-100 text-blue-800',
          2: 'bg-green-100 text-green-800',
          3: 'bg-orange-100 text-orange-800',
          4: 'bg-red-100 text-red-800',
        };
        const color = colors[row.level] || 'bg-gray-100 text-gray-800';
        return <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${color}`}>{labels[row.level] || `Mức ${row.level}`}</span>;
      }
    },
    { 
      key: 'status', 
      header: 'Trạng thái',
      render: (row) => {
        const colors: Record<string, string> = {
          'DRAFT': 'bg-gray-100 text-gray-800',
          'APPROVED': 'bg-success-500/10 text-success-500',
          'REJECTED': 'bg-danger-500/10 text-danger-500',
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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => console.log('Edit', row.id)}>Sửa</Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteId(row.id)}>Xóa</Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Ngân hàng Câu hỏi</h1>
          <p className="text-sm text-neutral-500 mt-1">Quản lý và duyệt câu hỏi trắc nghiệm</p>
        </div>
        <Link to="/admin/questions/new">
          <Button>+ Thêm câu hỏi</Button>
        </Link>
      </div>

      <DataTable 
        data={questions}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
      />

      <ConfirmDialog 
        isOpen={deleteId !== null}
        title="Xác nhận xóa"
        message={<p>Bạn có chắc chắn muốn xóa câu hỏi này? Hành động này không thể hoàn tác.</p>}
        isDestructive={true}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
