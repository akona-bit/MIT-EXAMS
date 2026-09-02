import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, Search, FileText, Trash2, Edit2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DataTable from '../../components/ui/DataTable';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { passageApi, PassageSearchResponse } from '../../api/passages';

export default function PassagesPage() {
  const navigate = useNavigate();
  const [passages, setPassages] = useState<PassageSearchResponse['results']>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPassages = async (query: string = '') => {
    try {
      setLoading(true);
      const data = await passageApi.search(query, 50); // Fetch top 50 for now
      setPassages(data.results);
    } catch (error) {
      console.error('Failed to fetch passages', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchPassages(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setIsDeleting(true);
      await passageApi.delete(deleteId);
      setPassages(prev => prev.filter(p => p.public_code !== deleteId));
    } catch (error: any) {
      console.error('Failed to delete passage', error);
      alert(error.response?.data?.detail || 'Không thể xóa ngữ liệu này.');
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const columns = [
    {
      header: 'Mã ngữ liệu',
      accessor: (row: any) => (
        <div className="font-mono text-sm text-neutral-600">{row.public_code}</div>
      ),
    },
    {
      header: 'Tiêu đề / Trích dẫn',
      accessor: (row: any) => (
        <div>
          <div className="font-medium text-neutral-900">{row.source_title || 'Không có tiêu đề'}</div>
          <div className="text-sm text-neutral-500 mt-1 line-clamp-1">{row.preview}</div>
        </div>
      ),
    },
    {
      header: 'Số câu hỏi',
      accessor: (row: any) => (
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
          {row.question_count} câu
        </div>
      ),
    },
    {
      header: 'Thao tác',
      accessor: (row: any) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/passages/${row.public_code}/edit`)}
            title="Chỉnh sửa"
          >
            <Edit2 className="w-4 h-4 text-neutral-500" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteId(row.public_code)}
            title="Xóa"
            className="hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    }
  ] as any[];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary-600" />
            Kho Ngữ Liệu
          </h1>
          <p className="text-neutral-500 mt-1">Quản lý các đoạn văn, bài đọc dùng chung cho nhiều câu hỏi.</p>
        </div>
        <Button onClick={() => navigate('/admin/passages/new')}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Thêm ngữ liệu
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b border-neutral-200">
          <div className="relative max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Tìm kiếm ngữ liệu theo tiêu đề hoặc nội dung..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <DataTable
          keyExtractor={(row) => row.id}
          columns={columns as any}
          data={passages}
          isLoading={loading}
          emptyMessage="Không tìm thấy ngữ liệu nào"
        />
      </Card>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Xóa ngữ liệu"
        message="Bạn có chắc chắn muốn xóa ngữ liệu này? Thao tác này sẽ gỡ liên kết ngữ liệu khỏi các câu hỏi hiện tại nhưng không xóa các câu hỏi đó."
        confirmText="Xóa"
        cancelText="Hủy"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isDeleting}
        isDestructive
      />
    </div>
  );
}
