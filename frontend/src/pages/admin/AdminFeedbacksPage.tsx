import React, { useState, useEffect } from 'react';
import { adminFeedbacksApi, type AdminFeedback } from '../../api/adminFeedbacks';
import { Button } from '../../components/ui/Button';
import { MessageSquare, ExternalLink, CheckCircle, Clock, XCircle } from 'lucide-react';

export default function AdminFeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<AdminFeedback[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');

  const fetchFeedbacks = async () => {
    setIsLoading(true);
    try {
      const skip = (page - 1) * limit;
      const res = await adminFeedbacksApi.getAll(skip, limit, filterStatus || undefined);
      setFeedbacks(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [page, filterStatus]);

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await adminFeedbacksApi.updateStatus(id, newStatus);
      setFeedbacks((prev) =>
        prev.map((fb) => (fb.id === id ? { ...fb, status: newStatus } : fb))
      );
    } catch (err) {
      console.error(err);
      alert('Không thể cập nhật trạng thái');
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'BUG':
        return <span className="px-2 py-1 bg-rose-100 text-rose-700 text-xs rounded-md font-medium">Lỗi web</span>;
      case 'EXAM_CONTENT':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-md font-medium">Lỗi đề thi</span>;
      default:
        return <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-md font-medium">Khác</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Đã xử lý</span>;
      case 'IGNORED':
        return <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-md font-medium flex items-center gap-1"><XCircle className="w-3 h-3" /> Đã bỏ qua</span>;
      default:
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Đang chờ</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary-500" />
            Quản lý Góp ý
          </h1>
          <p className="text-slate-500 text-sm mt-1">Danh sách góp ý và báo lỗi từ thí sinh</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="border-slate-300 rounded-lg text-sm bg-white px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Đang chờ xử lý</option>
            <option value="RESOLVED">Đã xử lý</option>
            <option value="IGNORED">Đã bỏ qua</option>
          </select>
        </div>
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
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : feedbacks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Chưa có góp ý nào.
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
                      <div className="max-w-md whitespace-pre-wrap break-words">{fb.content}</div>
                      {fb.context_data?.url && (
                        <a href={fb.context_data.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline mt-2">
                          <ExternalLink className="w-3 h-3" /> Xem bối cảnh
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-4">{getStatusBadge(fb.status)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs">
                      {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(fb.created_at))}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {fb.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleStatusChange(fb.id, 'RESOLVED')} className="bg-green-600 hover:bg-green-700">Đã xử lý</Button>
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(fb.id, 'IGNORED')}>Bỏ qua</Button>
                        </div>
                      )}
                      {fb.status !== 'PENDING' && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(fb.id, 'PENDING')}>Chuyển về Đang chờ</Button>
                      )}
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
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * limit >= total}
                onClick={() => setPage(p => p + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
