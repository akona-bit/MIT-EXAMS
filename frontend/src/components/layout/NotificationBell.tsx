import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  Trash2,
  X,
  Info,
  FileText,
  Star,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Inbox,
  CheckCheck,
} from 'lucide-react';
import { useNotifications, type NotificationItem } from '../../stores/notificationStore';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import Modal from '../ui/Modal';

const TYPE_ICON: Record<string, typeof Bell> = {
  SYSTEM: Info,
  EXAM: FileText,
  GRADING: Star,
  FEEDBACK: MessageSquare,
  OTHER: Bell,
};

// Màu icon + nền badge tròn theo loại thông báo
const TYPE_STYLE: Record<string, string> = {
  SYSTEM: 'text-info-600 bg-info-500/10 dark:text-info-500',
  EXAM: 'text-primary-600 bg-primary-500/10 dark:text-primary-400',
  GRADING: 'text-success-600 bg-success-500/10 dark:text-success-500',
  FEEDBACK: 'text-warning-600 bg-warning-500/10 dark:text-warning-500',
  OTHER: 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800',
};

// Ưu tiên icon theo nội dung (thông báo duyệt/từ chối câu hỏi dùng type SYSTEM
// nhưng nên hiện ✓/✗ cho trực quan)
function resolveIcon(n: NotificationItem): typeof Bell {
  const text = `${n.title} ${n.message}`.toLowerCase();
  if (text.includes('từ chối') || text.includes('reject')) return XCircle;
  if (text.includes('duyệt') || text.includes('approve')) return CheckCircle2;
  return TYPE_ICON[n.type] || Bell;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  if (mins < 1440) return `${Math.floor(mins / 60)} giờ trước`;
  const days = Math.floor(mins / 1440);
  if (days < 7) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

export default function NotificationBell() {
  const { notifications, unreadCount, fetchNotifications, fetchUnreadCount, markAsRead, markAllRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [detailNotification, setDetailNotification] = useState<NotificationItem | null>(null);

  // ESC để đóng panel
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
      fetchUnreadCount();
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.is_read) await markAsRead(n.id);
    setDetailNotification(n);
    setIsOpen(false);
  };

  const handleDetailClose = () => {
    if (detailNotification?.link) {
      navigate(detailNotification.link);
    }
    setDetailNotification(null);
  };

  return (
    <>
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
        aria-label="Thông báo"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-danger-500 text-white text-[10px] font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* __PANEL__ */}

      {/* Panel thông báo — portal ra <body> để thoát khỏi header có backdrop-blur
          (nguyên nhân panel bị MỜ trên mobile), nền đặc, responsive */}
      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[150]">
            {/* Backdrop: chỉ tối nhẹ trên mobile để tập trung, click để đóng */}
            <div
              className="absolute inset-0 bg-slate-900/30 sm:bg-transparent"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute inset-x-3 top-[70px] sm:inset-x-auto sm:right-6 sm:top-[72px] sm:w-[400px] flex flex-col max-h-[calc(100vh-90px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Thông báo</h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[11px] font-bold">
                      {unreadCount} mới
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      title="Đánh dấu tất cả đã đọc"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Danh sách */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <Inbox className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Chưa có thông báo nào</p>
                    <p className="text-xs text-slate-400 mt-1">Các thông báo mới sẽ xuất hiện tại đây.</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const Icon = resolveIcon(n);
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          'group flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70',
                          !n.is_read && 'bg-primary-500/5 dark:bg-primary-500/10'
                        )}
                      >
                        <span
                          className={cn(
                            'shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
                            TYPE_STYLE[n.type] || TYPE_STYLE.OTHER
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn('text-sm truncate', !n.is_read ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300')}>
                              {n.title}
                            </p>
                            <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(n.created_at)}</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                            {n.message}
                          </p>
                        </div>
                        {/* Chấm xanh tin chưa đọc + nút xoá (luôn hiện trên mobile vì không có hover) */}
                        <div className="flex items-center gap-1 shrink-0 self-center">
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary-500" />}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(n.id);
                            }}
                            title="Xoá thông báo"
                            className="p-1.5 rounded-lg text-slate-300 hover:text-danger-500 hover:bg-danger-500/10 dark:text-slate-600 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* __DETAIL__ */}

      {/* Modal chi tiết — cũng portal ra <body>, dùng component Modal chuẩn (nền đặc) */}
      {detailNotification &&
        createPortal(
          <Modal
            isOpen
            onClose={() => setDetailNotification(null)}
            title={detailNotification.title}
            maxWidth="max-w-md"
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                {(() => {
                  const Icon = resolveIcon(detailNotification);
                  return (
                    <span
                      className={cn(
                        'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                        TYPE_STYLE[detailNotification.type] || TYPE_STYLE.OTHER
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                  );
                })()}
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {detailNotification.message}
                </p>
              </div>
              {detailNotification.detail && (
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  <p className="font-semibold mb-1 text-slate-700 dark:text-slate-300">Chi tiết:</p>
                  {detailNotification.detail}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-400">
                {detailNotification.sender_name && <span>Gửi bởi: {detailNotification.sender_name}</span>}
                <span>
                  {detailNotification.created_at
                    ? new Date(detailNotification.created_at).toLocaleString('vi-VN')
                    : ''}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setDetailNotification(null)}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Đóng
              </button>
              {detailNotification.link && (
                <button
                  onClick={handleDetailClose}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                >
                  Xem chi tiết
                </button>
              )}
            </div>
          </Modal>,
          document.body
        )}
    </>
  );
}
