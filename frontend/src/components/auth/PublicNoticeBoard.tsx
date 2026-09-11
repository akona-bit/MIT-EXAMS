import { useState, useEffect } from "react";
import { Info, FileText, Star, MessageSquare, Bell, Calendar, ChevronRight } from "lucide-react";
import { getPublicNotifications, type NotificationItem } from "../../api/notifications";

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  SYSTEM: { label: "Hệ thống", icon: Info, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
  EXAM: { label: "Kỳ thi", icon: FileText, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/30" },
  GRADING: { label: "Chấm điểm", icon: Star, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  FEEDBACK: { label: "Góp ý", icon: MessageSquare, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
  OTHER: { label: "Khác", icon: Bell, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800" },
};

export default function PublicNoticeBoard() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "SYSTEM" | "EXAM">("ALL");

  useEffect(() => {
    loadPublicNotices();
  }, []);

  const loadPublicNotices = async () => {
    try {
      setIsLoading(true);
      const data = await getPublicNotifications(0, 50);
      setNotifications(data.items || []);
    } catch (e) {
      console.error("Failed to load public notifications", e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredNotices = notifications.filter(n => {
    if (activeTab === "ALL") return true;
    if (activeTab === "SYSTEM") return n.type === "SYSTEM";
    if (activeTab === "EXAM") return n.type === "EXAM";
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden animate-in slide-in-from-left-4 duration-500">
      <div className="p-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Bell className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Bảng thông báo</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tin tức & Cập nhật từ hệ thống</p>
          </div>
        </div>

        <div className="flex gap-2">
          {["ALL", "SYSTEM", "EXAM"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === tab
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              {tab === "ALL" ? "Tất cả" : tab === "SYSTEM" ? "Hệ thống" : "Kỳ thi"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-sm">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mb-3"></div>
            Đang tải thông báo...
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center text-sm">
            <Bell className="w-10 h-10 mb-3 opacity-20" />
            <p>Chưa có thông báo nào mới.</p>
          </div>
        ) : (
          filteredNotices.map((notif) => {
            const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.OTHER;
            const Icon = config.icon;
            
            return (
              <div key={notif.id} className="group relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 hover:shadow-sm transition-all hover:border-primary-200 dark:hover:border-primary-900/50">
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${config.bg}`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {notif.created_at ? new Date(notif.created_at).toLocaleDateString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        }) : ''}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 leading-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {notif.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line line-clamp-2">
                      {notif.message}
                    </p>
                    {notif.detail && (
                      <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-md text-xs text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
                        {notif.detail}
                      </div>
                    )}
                    {notif.link && (
                      <a 
                        href={notif.link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Xem chi tiết <ChevronRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
