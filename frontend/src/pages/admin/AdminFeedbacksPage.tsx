import React, { useState, useEffect } from 'react';
import { adminFeedbacksApi, type AdminFeedback, type FeedbackStats } from '../../api/adminFeedbacks';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { MessageSquare, ExternalLink, CheckCircle, Clock, XCircle, Inbox, Trash2, Eye, BarChart3 } from 'lucide-react';
import { toast } from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

export default function AdminFeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<AdminFeedback[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<AdminFeedback | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const fetchFeedbacks = async () => {
    setIsLoading(true);
    try {
      const skip = (page - 1) * limit;
      const res = await adminFeedbacksApi.getAll(skip, limit, filterStatus || undefined, filterCategory || undefined, search || undefined);
      setFeedbacks(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await adminFeedbacksApi.getStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [page, filterStatus, filterCategory, search]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await adminFeedbacksApi.updateStatus(id, newStatus);
      setFeedbacks((prev) =>
        prev.map((fb) => (fb.id === id ? { ...fb, status: newStatus } : fb))
      );
      toast.success('Cập nhật trạng thái thành công');
      fetchStats();
    } catch (err) {
      console.error(err);
      toast.error('Không thể cập nhật trạng thái');
    }
  };

  const handleDelete = (id: number) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    if (id === null) return;
    try {
      await adminFeedbacksApi.delete(id);
      setFeedbacks((prev) => prev.filter((fb) => fb.id !== id));
      setTotal((prev) => prev - 1);
      toast.success('Xóa feedback thành công');
      fetchStats();
    } catch (err) {
      console.error(err);
      toast.error('Không thể xóa feedback');
    }
  };

  const handleViewDetail = async (id: number) => {
    try {
      const fb = await adminFeedbacksApi.getById(id);
      setSelectedFeedback(fb);
      setShowDetail(true);
    } catch (err) {
      toast.error('Không thể tải chi tiết');
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'BUG':
        return <Badge variant="destructive">Lỗi web</Badge>;
      case 'EXAM_CONTENT':
        return <Badge variant="warning">Lỗi đề thi</Badge>;
      default:
        return <Badge variant="info">Khác</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" /> Đã xử lý</Badge>;
      case 'IGNORED':
        return <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" /> Đã bỏ qua</Badge>;
      default:
        return <Badge variant="info"><Clock className="w-3 h-3 mr-1" /> Đang chờ</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient flex items-center gap-3 pb-1">
            <MessageSquare className="w-8 h-8 text-primary-500" />
            Quản lý Góp ý
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Danh sách góp ý và báo lỗi từ thí sinh</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="text-sm text-slate-500">Tổng cộng</div>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
            <div className="text-sm text-amber-600">Đang chờ</div>
            <div className="text-2xl font-bold text-amber-700">{stats.by_status.PENDING || 0}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-green-200 shadow-sm">
            <div className="text-sm text-green-600">Đã xử lý</div>
            <div className="text-2xl font-bold text-green-700">{stats.by_status.RESOLVED || 0}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="text-sm text-slate-500">Đã bỏ qua</div>
            <div className="text-2xl font-bold text-slate-600">{stats.by_status.IGNORED || 0}</div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Tìm kiếm nội dung..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        />
        <Select
          options={[
            { value: '', label: 'Tất cả phân loại' },
            { value: 'BUG', label: 'Lỗi web' },
            { value: 'EXAM_CONTENT', label: 'Lỗi đề thi' },
            { value: 'OTHER', label: 'Khác' },
          ]}
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
        />
        <Select
          options={[
            { value: '', label: 'Tất cả trạng thái' },
            { value: 'PENDING', label: 'Đang chờ xử lý' },
            { value: 'RESOLVED', label: 'Đã xử lý' },
            { value: 'IGNORED', label: 'Đã bỏ qua' },
          ]}
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-16">ID</th>
                <th className="px-4 py-3 w-48">Người gửi</th>
                <th className="px-4 py-3 w-32">Phân loại</th>
                <th className="px-4 py-3">Nội dung</th>
                <th className="px-4 py-3 w-32">Trạng thái</th>
                <th className="px-4 py-3 w-32">Thời gian</th>
                <th className="px-4 py-3 w-48">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8">
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <Skeleton className="h-4 w-12" />
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 flex-1" />
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ) : feedbacks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Inbox className="w-12 h-12 mb-3" />
                      <p className="text-sm font-medium">Chưa có góp ý nào</p>
                    </div>
                  </td>
                </tr>
              ) : (
                feedbacks.map((fb) => (
                  <tr key={fb.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 font-medium text-slate-900">#{fb.id}</td>
                    <td className="px-4 py-4">
                      {fb.user?.username || `User ${fb.user_id}`}
                      {fb.context_data?.exam_session_id && (
                        <div className="text-xs text-slate-400 mt-0.5">Session: {fb.context_data.exam_session_id}</div>
                      )}
                    </td>
                    <td className="px-4 py-4">{getCategoryBadge(fb.category)}</td>
                    <td className="px-4 py-4">
                      <div className="max-w-md whitespace-pre-wrap break-words line-clamp-2">{fb.content}</div>
                    </td>
                    <td className="px-4 py-4">{getStatusBadge(fb.status)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs">
                      {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(fb.created_at))}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleViewDetail(fb.id)}>
                          <Eye className="w-3 h-3" />
                        </Button>
                        {fb.status === 'PENDING' && (
                          <>
                            <Button size="sm" onClick={() => handleStatusChange(fb.id, 'RESOLVED')} className="bg-green-600 hover:bg-green-700">
                              <CheckCircle className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleStatusChange(fb.id, 'IGNORED')}>
                              <XCircle className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                        {fb.status !== 'PENDING' && (
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(fb.id, 'PENDING')}>
                            <Clock className="w-3 h-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleDelete(fb.id)} className="text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <div className="text-sm text-slate-500">
              Hiển thị <span className="font-medium text-slate-900">{(page - 1) * limit + 1}</span> đến <span className="font-medium text-slate-900">{Math.min(page * limit, total)}</span> trong tổng số <span className="font-medium text-slate-900">{total}</span>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                Trước
              </Button>
              <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>

      {showDetail && selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold">Chi tiết Feedback #{selectedFeedback.id}</h3>
              <button onClick={() => setShowDetail(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="text-sm text-slate-500">Người gửi:</span>
                <p className="font-medium">{selectedFeedback.user?.username || `User ${selectedFeedback.user_id}`}</p>
              </div>
              <div>
                <span className="text-sm text-slate-500">Phân loại:</span>
                <div className="mt-1">{getCategoryBadge(selectedFeedback.category)}</div>
              </div>
              <div>
                <span className="text-sm text-slate-500">Trạng thái:</span>
                <div className="mt-1">{getStatusBadge(selectedFeedback.status)}</div>
              </div>
              <div>
                <span className="text-sm text-slate-500">Nội dung:</span>
                <p className="mt-1 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg text-sm">{selectedFeedback.content}</p>
              </div>
              {selectedFeedback.context_data && (
                <div>
                  <span className="text-sm text-slate-500">Context:</span>
                  <pre className="mt-1 bg-slate-50 p-3 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedFeedback.context_data, null, 2)}
                  </pre>
                </div>
              )}
              <div>
                <span className="text-sm text-slate-500">Thời gian:</span>
                <p className="text-sm">{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(selectedFeedback.created_at))}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title="Xoá feedback?"
        message="Feedback này sẽ bị xoá vĩnh viễn và không thể khôi phục."
        confirmText="Xoá"
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
