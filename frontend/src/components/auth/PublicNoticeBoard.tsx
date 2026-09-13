import { useState, useEffect } from "react";
import { Info, FileText, Star, MessageSquare, Bell, Calendar, ChevronRight, Sparkles } from "lucide-react";
import { getPublicNotifications, type NotificationItem } from "../../api/notifications";

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; gradient: string }> = {
  SYSTEM: { label: "Hệ thống", icon: Info, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", gradient: "from-blue-500 to-cyan-500" },
  EXAM: { label: "Kỳ thi", icon: FileText, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/30", gradient: "from-violet-500 to-purple-500" },
  GRADING: { label: "Chấm điểm", icon: Star, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", gradient: "from-emerald-500 to-teal-500" },
  FEEDBACK: { label: "Góp ý", icon: MessageSquare, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", gradient: "from-amber-500 to-orange-500" },
  OTHER: { label: "Khác", icon: Bell, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800", gradient: "from-slate-500 to-gray-500" },
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
    <div className="flex flex-col h-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] overflow-hidden relative">
      {/* Decorative gradient orb */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-primary-400/20 dark:bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative p-6 pb-5 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-primary-500 blur-md opacity-30 group-hover:opacity-50 transition-opacity duration-500 rounded-full" />
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white shadow-lg transform group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
              <Bell className="w-6 h-6" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 leading-tight flex items-center gap-2">
              Bảng Thông Báo
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">Cập nhật những tin tức mới nhất</p>
          </div>
        </div>

        <div className="flex gap-2 p-1.5 bg-slate-100/60 dark:bg-slate-800/60 rounded-xl backdrop-blur-sm w-fit border border-white/30 dark:border-slate-700/40">
          {["ALL", "SYSTEM", "EXAM"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${
                activeTab === tab
                  ? "bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50"
              }`}
            >
              {tab === "ALL" ? "Tất cả" : tab === "SYSTEM" ? "Hệ thống" : "Kỳ thi"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 relative z-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm">
            <div className="relative w-10 h-10 mb-4">
               <div className="absolute inset-0 border-4 border-primary-100 dark:border-primary-900/30 rounded-full" />
               <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <span className="font-semibold animate-pulse text-slate-500">Đang tải thông báo...</span>
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-center text-sm">
            <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
              <Bell className="w-8 h-8 opacity-30" />
            </div>
            <p className="font-medium text-slate-500">Chưa có thông báo nào mới.</p>
          </div>
        ) : (
          filteredNotices.map((notif) => {
            const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.OTHER;
            const Icon = config.icon;
            
            return (
              <div 
                key={notif.id} 
                className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 hover:shadow-[0_8px_24px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_24px_rgb(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              >
                {/* Hover gradient line */}
                <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${config.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                
                <div className="flex items-start gap-4">
                  <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${config.bg} relative overflow-hidden group-hover:scale-110 transition-transform duration-300`}>
                    <div className="absolute inset-0 bg-white/20 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Icon className={`w-6 h-6 ${config.color} relative z-10`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        <Calendar className="w-3 h-3" />
                        {notif.created_at ? new Date(notif.created_at).toLocaleDateString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        }) : ''}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 leading-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {notif.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line line-clamp-2">
                      {notif.message}
                    </p>
                    {notif.detail && (
                      <div className="mt-3 p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl text-xs text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700/50 leading-relaxed">
                        {notif.detail}
                      </div>
                    )}
                    {notif.link && (
                      <a 
                        href={notif.link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors group/link"
                      >
                        Xem chi tiết <ChevronRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
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
