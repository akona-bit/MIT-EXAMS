import { useState, useEffect } from "react";
import { Search, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import CelebrationOverlay from "./CelebrationOverlay";

export default function StudentAnalyticsPage() {
  const [search, setSearch] = useState("");
  const [student, setStudent] = useState<any>(null);
  const [responses, setResponses] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [classSummary, setClassSummary] = useState<any>(null);

  useEffect(() => {
    fetchClassSummary();
  }, []);

  const fetchClassSummary = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/analytics/class-summary");
      const data = await res.json();
      setClassSummary(data);
    } catch (e) {
      console.error("Failed to fetch class summary");
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search) return;
    
    setIsLoading(true);
    setStudent(null);
    setResponses(null);
    
    try {
      // Fetch student score
      const res1 = await fetch(`http://localhost:8000/api/v1/analytics/students?search=${encodeURIComponent(search)}`);
      const data1 = await res1.json();
      
      // Fetch responses
      let resData = null;
      try {
        const res2 = await fetch(`http://localhost:8000/api/v1/analytics/responses/${encodeURIComponent(search)}`);
        if (res2.ok) {
          resData = await res2.json();
        }
      } catch (err) {}
      
      if (data1.items && data1.items.length > 0) {
        setStudent(data1.items[0]);
      } else {
        alert("Không tìm thấy học sinh!");
      }
      if (resData) {
        setResponses(resData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getKnowledgeMatrix = () => {
    if (!responses || !responses.responses) return null;
    const questions = Object.keys(responses.responses).map(q => {
      const num = parseInt(q.replace("Câu ", ""));
      return { num, q, status: responses.responses[q] };
    });
    
    return (
      <div className="grid grid-cols-10 sm:grid-cols-15 gap-2 mt-4">
        {questions.map((q) => {
          let bg = "bg-slate-100 dark:bg-slate-800 text-slate-500";
          if (q.status === "correct") bg = "bg-success-500 text-white shadow-success-500/20 shadow-lg";
          else if (q.status === "wrong") bg = "bg-danger-500 text-white shadow-danger-500/20 shadow-lg";
          
          return (
            <div key={q.q} className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all hover:scale-110 ${bg}`} title={`${q.q}: ${q.status}`}>
              {q.num}
            </div>
          );
        })}
      </div>
    );
  };

  const getRadarData = () => {
    if (!student || !classSummary) return [];
    return [
      {
        subject: "Toán (IRT)",
        "Điểm của bạn": student.irt_toan || 0,
        "Trung bình lớp": classSummary.avg_toan || 0,
        fullMark: 300,
      },
      {
        subject: "TDKH (IRT)",
        "Điểm của bạn": student.irt_tdkh || 0,
        "Trung bình lớp": classSummary.avg_tdkh || 0,
        fullMark: 300,
      },
      {
        subject: "Toán (Thô)",
        "Điểm của bạn": (student.tho_toan || 0) * 10,
        "Trung bình lớp": 150,
        fullMark: 300,
      },
      {
        subject: "TDKH (Thô)",
        "Điểm của bạn": (student.tho_tdkh || 0) * 10,
        "Trung bình lớp": 150,
        fullMark: 300,
      },
    ];
  };

  return (
    <div className="space-y-6">
      <CelebrationOverlay 
        studentName={student?.name} 
        valedictorianName={classSummary?.valedictorian?.name} 
        salutatorianName={classSummary?.salutatorian?.name} 
      />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tra Cứu Điểm Cá Nhân</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Phân tích năng lực và lỗ hổng kiến thức qua điểm số
          </p>
        </div>
      </div>

      <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-neutral-900">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nhập họ tên hoặc email thí sinh..." 
              className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-11 pr-4 text-slate-900 placeholder:text-slate-500 outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500 dark:border-slate-800 dark:bg-neutral-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-primary-500 dark:focus:bg-neutral-900"
            />
          </div>
          <Button type="submit" size="lg" className="whitespace-nowrap">
            Tra cứu
          </Button>
        </form>
      </Card>

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <Skeleton className="h-[400px] w-full rounded-2xl" />
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      )}

      {student && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <div className="space-y-6">
            <Card className="p-6 relative overflow-hidden">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Thông tin thí sinh</h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Họ và tên</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{student.name}</p>
                </div>
                {responses && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Email liên kết</p>
                    <p className="text-base text-slate-700 dark:text-slate-300">{responses.email || "N/A"}</p>
                  </div>
                )}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Toán (IRT)</p>
                    <Badge variant="default" className="text-lg px-3 py-1">
                      {student.irt_toan !== null ? student.irt_toan.toFixed(1) : "N/A"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">TDKH (IRT)</p>
                    <Badge variant="success" className="text-lg px-3 py-1">
                      {student.irt_tdkh !== null ? student.irt_tdkh.toFixed(1) : "N/A"}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Thưởng/Phạt Toán</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{student.phat_toan !== null ? student.phat_toan : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Thưởng/Phạt TDKH</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{student.phat_tdkh !== null ? student.phat_tdkh : "N/A"}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-primary-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ma Trận Kiến Thức</h3>
              </div>
              <div className="flex gap-4 mb-4 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-success-500"></span> Đúng</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-danger-500"></span> Sai</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700"></span> Bỏ trống</div>
              </div>
              {getKnowledgeMatrix()}
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 h-[400px]">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Phân tích năng lực (Radar)</h3>
              </div>
              <ResponsiveContainer width="100%" height="80%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={getRadarData()}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 300]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Radar name="Điểm của bạn" dataKey="Điểm của bạn" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
                  <Radar name="Trung bình lớp" dataKey="Trung bình lớp" stroke="#cbd5e1" fill="#cbd5e1" fillOpacity={0.3} />
                  <Tooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
               <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-500/10">
                    <AlertTriangle className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Lời khuyên ôn tập</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Dựa trên kết quả ma trận kiến thức, bạn nên tập trung cải thiện các phần kiến thức tương ứng với các câu trả lời sai (Màu đỏ). Đặc biệt lưu ý việc bỏ trống quá nhiều sẽ bị mất điểm theo cơ chế IRT 2PL.
                    </p>
                  </div>
               </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
