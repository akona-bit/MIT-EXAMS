import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, Search, FileText, Trash2, Edit2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import { toast } from '../../components/ui/Toast';
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
      toast.error(error.response?.data?.detail || 'Không thể xóa ngữ liệu này.');
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const columns = [
    {
      key: 'public_code',
      header: 'Mã ngữ liệu',
      render: (row: any) => (
        <div className="font-mono text-sm text-primary-600 dark:text-primary-400">{row.public_code}</div>
      ),
    },
    {
      key: 'preview',
      header: 'Tiêu đề / Trích dẫn',
      render: (row: any) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white">{row.source_title || 'Không có tiêu đề'}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 max-w-lg">{row.preview}</div>
        </div>
      ),
    },
    {
      key: 'question_count',
      header: 'Số câu hỏi',
      render: (row: any) => (
        <Badge variant="info">{row.question_count} câu</Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (row: any) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/passages/${row.public_code}/edit`)}
            title="Chỉnh sửa"
            className="hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteId(row.public_code)}
            title="Xóa"
            className="hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    }
  ] as any[];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient flex items-center gap-3 pb-1">
            <FileText className="w-8 h-8 text-primary-500" />
            Kho Ngữ Liệu
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Quản lý các đoạn văn, bài đọc dùng chung cho nhiều câu hỏi.</p>
        </div>
        <Button onClick={() => navigate('/admin/passages/new')} className="shadow-lg shadow-primary-500/20 px-6">
          <PlusIcon className="w-5 h-5 mr-2" />
          Thêm ngữ liệu
        </Button>
      </div>

      <div className="glass-card p-6 border-t-4 border-t-primary-500">
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              label=""
              placeholder="Tìm kiếm theo mã, tiêu đề, nội dung..."
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
      </div>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Xóa ngữ liệu"
        message="Bạn có chắc chắn muốn xóa ngữ liệu này? Thao tác này sẽ gỡ liên kết ngữ liệu khỏi các câu hỏi hiện tại nhưng không xóa nội dung các câu hỏi đó."
        confirmText="Xóa ngữ liệu"
        cancelText="Hủy bỏ"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isDeleting}
        isDestructive
      />
    </div>
  );
}
