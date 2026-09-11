import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { ArrowLeft, Trophy, Medal, User, Activity, Star, Crown } from "lucide-react";
import Button from "../../components/ui/Button";

interface HistoryItem {
  id: number;
  name: string;
  date: string;
  score: number | null;
  max_score: number;
  time_spent: number;
  status: string;
}

interface LeaderboardRecord {
  user_id: number;
  name: string;
  score: number;
  submit_time: string | null;
  rank: number;
}

interface LeaderboardData {
  status: string;
  top_10: LeaderboardRecord[];
  current_user_rank: number;
  total_participants_in_form: number;
}

export default function StudentLeaderboardPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<HistoryItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  useEffect(() => {
    api.get("/api/v1/exams/my-history")
      .then((res) => {
        const items: HistoryItem[] = res.data.items || [];
        const submitted = items.filter(h => h.status === "SUBMITTED");
        setExams(submitted);
        if (submitted.length > 0) {
          setSelectedExamId(submitted[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingExams(false));
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      setIsLoadingLeaderboard(true);
      api.get(`/api/v1/exams/${selectedExamId}/leaderboard`)
        .then(res => {
          setLeaderboard(res.data);
        })
        .catch(() => setLeaderboard(null))
        .finally(() => setIsLoadingLeaderboard(false));
    }
  }, [selectedExamId]);

  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="pb-20 min-h-screen bg-slate-50 dark:bg-[#060b14] selection:bg-amber-500/30">
      {/* Hero Header */}
      <div className="relative pt-8 pb-32 overflow-hidden bg-gradient-to-br from-amber-600 via-orange-500 to-rose-600">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-amber-300/20 rounded-full blur-2xl"></div>
        </div>
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Button variant="ghost" className="text-white hover:bg-white/20 hover:text-white mb-8 -ml-2 font-medium rounded-full px-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Trở về
          </Button>
          <div className="text-white flex flex-col md:flex-row items-start md:items-center gap-6">
             <div className="p-5 bg-white/10 rounded-3xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] transform rotate-3 hover:rotate-0 transition-transform duration-300">
               <Trophy className="w-12 h-12 text-amber-100" />
             </div>
             <div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight drop-shadow-sm">Bảng Vàng Thành Tích</h1>
                <p className="text-amber-100/90 mt-2 font-medium text-lg max-w-xl">
                  Nơi vinh danh những thí sinh có điểm số cao nhất. Cùng so tài và khẳng định bản lĩnh!
                </p>
             </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-20 animate-in fade-in slide-in-from-bottom-8 duration-700 flex flex-col lg:flex-row gap-8">
        
        {/* Left Sidebar: Exam List */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 lg:sticky lg:top-24 self-start">
          <div className="bg-white dark:bg-[#0b1121] rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/50 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Kỳ thi của bạn</h2>
            </div>
            <div className="p-3 max-h-[500px] overflow-y-auto custom-scrollbar">
              {isLoadingExams ? (
                <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-amber-500"></div></div>
              ) : exams.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <Activity className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">Bạn chưa hoàn thành kỳ thi nào.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {exams.map(exam => (
                    <button
                      key={exam.id}
                      onClick={() => setSelectedExamId(exam.id)}
                      className={`text-left p-4 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                        selectedExamId === exam.id 
                          ? "bg-amber-50 dark:bg-amber-500/10 border-transparent shadow-sm" 
                          : "bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent"
                      }`}
                    >
                      {selectedExamId === exam.id && (
                        <div className="absolute left-0 top-0 w-1 h-full bg-amber-500 rounded-r-full"></div>
                      )}
                      <p className={`font-bold truncate pr-4 ${selectedExamId === exam.id ? "text-amber-700 dark:text-amber-400" : "text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white"}`}>
                        {exam.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        Điểm của bạn: <span className={`font-bold ${selectedExamId === exam.id ? 'text-amber-600 dark:text-amber-500' : 'text-slate-700 dark:text-slate-300'}`}>{exam.score}</span> / {exam.max_score}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Content: Leaderboard */}
        <div className="w-full lg:w-2/3">
          <div className="bg-white dark:bg-[#0b1121] rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[600px] flex flex-col">
             <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-transparent to-slate-50/50 dark:to-slate-900/30">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                     Top 10 Xuất Sắc
                  </h2>
                  {selectedExam && <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{selectedExam.name}</p>}
                </div>
             </div>
             
             <div className="p-4 sm:p-8 flex-1">
                {isLoadingLeaderboard ? (
                   <div className="flex h-full min-h-[300px] items-center justify-center">
                     <div className="relative">
                       <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 dark:border-slate-800 border-t-amber-500"></div>
                       <div className="absolute inset-0 flex items-center justify-center">
                         <Trophy className="w-4 h-4 text-amber-500" />
                       </div>
                     </div>
                   </div>
                ) : !leaderboard || leaderboard.status === "no_data" ? (
                   <div className="flex flex-col h-full min-h-[300px] items-center justify-center text-center">
                      <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-4 border border-slate-100 dark:border-slate-800">
                         <Activity className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">Chưa có dữ liệu</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">Bảng xếp hạng cho mã đề này hiện chưa khả dụng. Hãy thử lại sau.</p>
                   </div>
                ) : (
                  <div className="space-y-8 animate-in fade-in duration-500">
                    {/* Current User Rank Card */}
                    <div className="p-1 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-lg shadow-amber-500/20">
                      <div className="bg-white dark:bg-[#0b1121] rounded-[14px] p-5 sm:p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4 sm:gap-6">
                          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-100 dark:border-amber-500/20 flex items-center justify-center text-amber-500 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-transparent"></div>
                            <Medal className="w-7 h-7 relative z-10" />
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Thứ hạng của bạn</p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-500 to-orange-600">
                                {leaderboard.current_user_rank > 0 ? `#${leaderboard.current_user_rank}` : "---"}
                              </span>
                              <span className="text-sm font-bold text-slate-400">
                                / {leaderboard.total_participants_in_form} thí sinh
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top 10 List */}
                    <div className="space-y-3">
                      {leaderboard.top_10.map((student, idx) => {
                        const isTop1 = student.rank === 1;
                        const isTop2 = student.rank === 2;
                        const isTop3 = student.rank === 3;
                        
                        return (
                          <div 
                            key={idx} 
                            className={`group flex items-center p-4 rounded-2xl transition-all duration-300 border
                              ${isTop1 ? 'bg-gradient-to-r from-yellow-50 to-white dark:from-yellow-900/20 dark:to-transparent border-yellow-200 dark:border-yellow-900/50 shadow-sm' : 
                                isTop2 ? 'bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/30 dark:to-transparent border-slate-200 dark:border-slate-700 shadow-sm' : 
                                isTop3 ? 'bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/10 dark:to-transparent border-orange-200 dark:border-orange-900/30 shadow-sm' : 
                                'bg-white dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-md'}`}
                          >
                            <div className="w-12 h-12 flex items-center justify-center shrink-0 mr-4">
                              {isTop1 ? (
                                <div className="relative">
                                  <div className="absolute inset-0 bg-yellow-400 blur-md opacity-40 rounded-full"></div>
                                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-300 to-yellow-500 text-white rounded-full flex items-center justify-center font-black shadow-lg relative z-10 border border-yellow-200">1</div>
                                  <Crown className="absolute -top-3 -right-2 w-5 h-5 text-yellow-500 rotate-12 z-20 drop-shadow-sm" />
                                </div>
                              ) : isTop2 ? (
                                <div className="w-10 h-10 bg-gradient-to-br from-slate-300 to-slate-400 text-white rounded-full flex items-center justify-center font-black shadow-md border border-slate-200">2</div>
                              ) : isTop3 ? (
                                <div className="w-10 h-10 bg-gradient-to-br from-orange-300 to-orange-500 text-white rounded-full flex items-center justify-center font-black shadow-md border border-orange-200">3</div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-sm">
                                  {student.rank}
                                </div>
                              )}
                            </div>
                            
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
                               <User className="w-5 h-5 opacity-70" />
                            </div>
                            
                            <div className="flex-1 min-w-0 ml-4 group-hover:translate-x-1 transition-transform duration-300">
                              <p className={`font-bold truncate text-base ${isTop1 ? 'text-yellow-700 dark:text-yellow-400' : isTop2 ? 'text-slate-700 dark:text-slate-300' : isTop3 ? 'text-orange-700 dark:text-orange-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                {student.name}
                              </p>
                              {student.submit_time && (
                                <p className="text-xs text-slate-400 mt-0.5 truncate">
                                  Nộp lúc: {new Date(student.submit_time).toLocaleString('vi-VN')}
                                </p>
                              )}
                            </div>
                            
                            <div className="text-right shrink-0 ml-4">
                              <p className={`text-xl font-black ${isTop1 ? 'text-yellow-600 dark:text-yellow-500' : isTop2 ? 'text-slate-600 dark:text-slate-400' : isTop3 ? 'text-orange-600 dark:text-orange-500' : 'text-primary-600 dark:text-primary-400'}`}>
                                {student.score}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Điểm</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
