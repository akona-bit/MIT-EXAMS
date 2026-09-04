import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../stores/authStore";
import { ArrowLeft, User, Mail, Hash, Calendar, Trophy, BarChart3, Clock, ArrowRight } from "lucide-react";
import Button from "../../components/ui/Button";

interface HistoryItem {
  id: number;
  name: string;
  date: string;
  score: number;
  max_score: number;
  time_spent: number;
}

export default function StudentDetailPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [history] = useState<HistoryItem[]>([]);
  const [isLoading] = useState(false);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="pb-20">
      {/* Hero Header */}
      <div className="bg-primary-600 pt-8 pb-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" className="text-white hover:bg-white/20 hover:text-white mb-6 -ml-2 font-bold" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5 mr-2" /> Quay lại trang chủ
          </Button>
          <div className="flex items-center gap-6">
             <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-white/20">
                <User className="w-12 h-12 text-primary-500" />
             </div>
             <div className="text-white">
                <h1 className="text-3xl font-black">{user?.full_name || user?.username || "Thí sinh"}</h1>
                <p className="text-primary-100 mt-1 flex items-center gap-2">
                   <Mail className="w-4 h-4" /> {user?.email || "Chưa cập nhật email"}
                </p>
                <p className="text-primary-100 mt-1 flex items-center gap-2 font-mono text-sm">
                   <Hash className="w-4 h-4" /> SBD: {user?.username || "---"}
                </p>
             </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 flex items-center gap-4">
              <div className="p-4 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 rounded-xl">
                 <Trophy className="w-8 h-8" />
              </div>
              <div>
                 <div className="text-3xl font-black text-slate-800 dark:text-white">85.0</div>
                 <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Điểm trung bình</div>
              </div>
           </div>
           
           <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 flex items-center gap-4">
              <div className="p-4 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-xl">
                 <BarChart3 className="w-8 h-8" />
              </div>
              <div>
                 <div className="text-3xl font-black text-slate-800 dark:text-white">{history.length}</div>
                 <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Bài thi đã làm</div>
              </div>
           </div>

           <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
               <Button onClick={() => navigate('/student/compare')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/30">
                  So sánh năng lực <ArrowRight className="w-5 h-5 ml-2" />
               </Button>
           </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
           <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Lịch sử làm bài</h2>
           </div>
           
           {isLoading ? (
             <div className="p-12 text-center">
               <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-primary-600 mb-4"></div>
               <p className="text-slate-500 font-medium">Đang tải lịch sử làm bài...</p>
             </div>
           ) : history.length === 0 ? (
             <div className="p-12 text-center text-slate-500">
               <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
               <p className="font-medium">Chưa có lịch sử làm bài</p>
             </div>
           ) : (
             <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
               {history.map(item => (
                 <div key={item.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                       <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">{item.name}</h3>
                       <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 font-medium">
                          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {formatDate(item.date)}</span>
                          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {item.time_spent} phút</span>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                       <div className="text-right">
                          <div className="text-2xl font-black text-primary-600">{item.score}<span className="text-sm text-slate-400 font-bold">/{item.max_score}</span></div>
                          <div className="text-xs font-bold text-slate-400 uppercase">Điểm số</div>
                       </div>
                       <Button variant="outline" className="font-bold shrink-0" onClick={() => navigate(`/student/exam/${item.id}/result`)}>
                          Chi tiết
                       </Button>
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
