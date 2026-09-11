import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../stores/authStore";
import api from "../../api/client";
import { ArrowLeft, User, Mail, Hash, Calendar, Trophy, BarChart3, Clock, Edit3, Save, X } from "lucide-react";
import Button from "../../components/ui/Button";
import VActProgressCard from "../../components/student-profile/VActProgressCard";
import VActRadarCard from "../../components/student-profile/VActRadarCard";
import ActivityHeatmapCard from "../../components/student-profile/ActivityHeatmapCard";
import KnowledgeNetworkCard from "../../components/student-profile/KnowledgeNetworkCard";

interface HistoryItem {
  id: number;
  name: string;
  date: string;
  score: number | null;
  max_score: number;
  time_spent: number;
  status: string;
}

export default function StudentDetailPage() {
  const navigate = useNavigate();
  const { user, fetchUser } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [avgScore, setAvgScore] = useState(0);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: user?.full_name || "",
    gender: user?.gender || "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setEditForm({
        full_name: user.full_name || "",
        gender: user.gender || "",
      });
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        const res = await api.get("/api/v1/exams/my-history");
        if (!isMounted) return;
        const items = res.data.items || [];
        setHistory(items);
        const scored = items.filter((h: HistoryItem) => h.score !== null);
        if (scored.length > 0) {
          const total = scored.reduce((sum: number, h: HistoryItem) => sum + (h.score || 0), 0);
          setAvgScore(Math.round(total / scored.length * 10) / 10);
        }
      } catch (err) {
        console.error("Failed to fetch history", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      await api.patch("/api/v1/users/me", {
        full_name: editForm.full_name,
        gender: editForm.gender === "" ? null : editForm.gender,
      });
      await fetchUser();
      setIsEditing(false);
    } catch (e) {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const getGenderLabel = (g: string | null | undefined) => {
    if (g === "nam") return "Nam";
    if (g === "nu") return "Nữ";
    if (g === "gay") return "Gay";
    return "Chưa cập nhật";
  };

  return (
    <div className="pb-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
      {/* Top Section: Profile & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Profile Card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col justify-center">
          <div className="mb-6 -mt-2 -ml-2">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
            </Button>
          </div>
          <div className="flex flex-col md:flex-row md:items-start gap-8 justify-between">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 w-full">
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                <User className="w-10 h-10 text-slate-400" />
              </div>
              
              {isEditing ? (
                <div className="w-full max-w-md space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Họ và tên</label>
                    <input 
                      type="text" 
                      value={editForm.full_name}
                      onChange={e => setEditForm({...editForm, full_name: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                      placeholder="Nhập họ và tên"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Giới tính</label>
                    <select 
                      value={editForm.gender}
                      onChange={e => setEditForm({...editForm, gender: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    >
                      <option value="">Không tiết lộ</option>
                      <option value="nam">Nam</option>
                      <option value="nu">Nữ</option>
                      <option value="gay">Gay</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      <X className="w-4 h-4 mr-2" /> Hủy
                    </Button>
                    <Button onClick={handleSaveProfile} disabled={isSaving}>
                      {isSaving ? "Đang lưu..." : <><Save className="w-4 h-4 mr-2" /> Lưu hồ sơ</>}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center sm:text-left flex-1">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    {user?.full_name || user?.username || "Thí sinh"}
                  </h1>
                  
                  <div className="flex flex-col gap-3 mt-4 text-sm text-slate-600 dark:text-slate-400">
                    <span className="flex items-center justify-center sm:justify-start gap-2">
                      <Mail className="w-4 h-4 text-slate-400" /> {user?.email || "Chưa cập nhật email"}
                    </span>
                    <span className="flex items-center justify-center sm:justify-start gap-2 font-mono">
                      <Hash className="w-4 h-4 text-slate-400" /> SBD: {user?.username || "---"}
                    </span>
                    <span className="flex items-center justify-center sm:justify-start gap-2">
                      <User className="w-4 h-4 text-slate-400" /> Giới tính: {getGenderLabel(user?.gender)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {!isEditing && (
              <div className="flex justify-center sm:justify-end shrink-0 w-full md:w-auto">
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit3 className="w-4 h-4 mr-2" /> Sửa hồ sơ
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 flex items-center gap-5 shadow-sm h-full">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
              <Trophy className="w-7 h-7" />
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">{avgScore || "--"}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Điểm trung bình</div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 flex items-center gap-5 shadow-sm h-full">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl border border-blue-100 dark:border-blue-800/30">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">{history.length}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Bài thi đã làm</div>
            </div>
          </div>
        </div>
      </div>

      {/* V-ACT Profile Section */}
      {user?.id && (
        <div className="mb-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <VActProgressCard studentId={user.id} />
              <ActivityHeatmapCard studentId={user.id} />
            </div>
            <div className="space-y-6">
              <VActRadarCard studentId={user.id} />
            </div>
          </div>
          <KnowledgeNetworkCard studentId={user.id} />
        </div>
      )}

      {/* History Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Lịch sử làm bài</h2>
        </div>
        
        {isLoading ? (
          <div className="p-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-primary-600 mb-4"></div>
            <p className="text-slate-500 font-medium text-sm">Đang tải lịch sử làm bài...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="p-16 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">Chưa có lịch sử làm bài</p>
            <p className="text-sm text-slate-500 mt-1">Bạn chưa hoàn thành bài thi nào.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {history.map(item => (
              <div key={item.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">{item.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(item.date)}</span>
                    {item.time_spent > 0 && (
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {item.time_spent} phút</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xl font-bold text-primary-600">
                      {item.score !== null ? item.score : "--"}
                      <span className="text-xs text-slate-400 font-semibold ml-0.5">/{item.max_score}</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Điểm số</div>
                  </div>
                  {item.status === "SUBMITTED" && (
                    <Button variant="secondary" size="sm" className="shrink-0" onClick={() => navigate(`/student/exam/${item.id}/result`)}>
                      Chi tiết
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
