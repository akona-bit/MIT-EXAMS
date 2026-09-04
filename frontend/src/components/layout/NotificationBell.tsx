import { useState, useRef, useEffect } from 'react';
import { Bell, Trash2, X, Info, FileText, Star, MessageSquare } from 'lucide-react';
import { useNotifications, type NotificationItem } from '../../stores/notificationStore';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';

const TYPE_ICON: Record<string, typeof Bell> = {
  SYSTEM: Info,
  EXAM: FileText,
  GRADING: Star,
  FEEDBACK: MessageSquare,
  OTHER: Bell,
};

const TYPE_COLOR: Record<string, string> = {
  SYSTEM: 'text-info-500',
  EXAM: 'text-primary-500',
  GRADING: 'text-success-500',
  FEEDBACK: 'text-warning-500',
  OTHER: 'text-slate-400',
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  return `${days} ngày trước`;
}

export default function NotificationBell() {
  const { notifications, unreadCount, fetchNotifications, fetchUnreadCount, markAsRead, markAllRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [detailNotification, setDetailNotification] = useState<NotificationItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all duration-200"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[380px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Thông báo</h3>
            {unreadCount > 0 && (
              <button
                onClick={async () => { await markAllRead(); fetchUnreadCount(); }}
                className="text-xs text-primary-500 hover:text-primary-600 font-medium"
              >
                Đánh dấu đã đọc tất cả
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Chưa có thông báo
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => {
                const Icon = TYPE_ICON[n.type] || Bell;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      'group flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-50 dark:border-white/5 last:border-0',
                      !n.is_read && 'bg-primary-50/30 dark:bg-primary-500/5'
                    )}
                  >
                    <div className={cn('shrink-0 mt-0.5', TYPE_COLOR[n.type])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm', !n.is_read ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!n.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary-500" />
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                        className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailNotification && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm" onClick={handleDetailClose} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = TYPE_ICON[detailNotification.type] || Bell;
                  return <Icon className={cn('h-5 w-5', TYPE_COLOR[detailNotification.type])} />;
                })()}
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{detailNotification.title}</h3>
              </div>
              <button onClick={handleDetailClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{detailNotification.message}</p>
              {detailNotification.detail && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs text-slate-500 dark:text-slate-400">
                  {detailNotification.detail}
                </div>
              )}
              {detailNotification.sender_name && (
                <p className="mt-3 text-xs text-slate-400">Gửi bởi: {detailNotification.sender_name}</p>
              )}
              <p className="mt-2 text-xs text-slate-300 dark:text-slate-600">
                {detailNotification.created_at ? new Date(detailNotification.created_at).toLocaleString('vi-VN') : ''}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 dark:border-white/5">
              {detailNotification.link && (
                <button
                  onClick={handleDetailClose}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white hover:shadow-lg transition-all"
                >
                  Xem chi tiết
                </button>
              )}
              <button
                onClick={() => setDetailNotification(null)}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
