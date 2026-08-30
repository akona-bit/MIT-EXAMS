import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Target, TrendingUp, AlertTriangle, ArrowLeft } from "lucide-react";
import { Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import CelebrationOverlay from "./CelebrationOverlay";

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>(); // Using name/id as parameter
  const navigate = useNavigate();
  
  const [student, setStudent] = useState<any>(null);
  const [responses, setResponses] = useState<any>(null);
  const [classSummary, setClassSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchStudentData(id);
    }
  }, [id]);

  const fetchStudentData = async (studentIdentifier: string) => {
    setIsLoading(true);
    try {
      // 1. Fetch class summary for radar chart baseline
      const resSummary = await fetch("http://localhost:8000/api/v1/analytics/class-summary");
      const summary = await resSummary.json();
      setClassSummary(summary);

      // 2. Fetch specific student
      const resStudent = await fetch(`http://localhost:8000/api/v1/analytics/students?search=${encodeURIComponent(studentIdentifier)}`);
      const studentData = await resStudent.json();
      
      if (studentData.items && studentData.items.length > 0) {
        setStudent(studentData.items[0]);
      }

      // 3. Fetch responses
      try {
        const resResp = await fetch(`http://localhost:8000/api/v1/analytics/responses/${encodeURIComponent(studentIdentifier)}`);
        if (resResp.ok) {
          const respData = await resResp.json();
          setResponses(respData);
        }
      } catch (err) {
        console.error("No response data found for student");
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
        "Điểm của thí sinh": student.irt_toan || 0,
        "Trung bình lớp": classSummary.avg_toan || 0,
        fullMark: 300,
      },
      {
        subject: "TDKH (IRT)",
        "Điểm của thí sinh": student.irt_tdkh || 0,
        "Trung bình lớp": classSummary.avg_tdkh || 0,
        fullMark: 300,
      },
      {
        subject: "Toán (Thô)",
        "Điểm của thí sinh": (student.tho_toan || 0) * 10,
        "Trung bình lớp": 150,
        fullMark: 300,
      },
      {
        subject: "TDKH (Thô)",
        "Điểm của thí sinh": (student.tho_tdkh || 0) * 10,
        "Trung bình lớp": 150,
        fullMark: 300,
      },
    ];
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/students')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
        </Button>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <Skeleton className="h-[400px] w-full rounded-2xl" />
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/students')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
        </Button>
        <Card className="p-12 text-center">
          <h2 className="text-xl font-bold text-slate-900">Không tìm thấy thí sinh</h2>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CelebrationOverlay 
        studentName={student?.name} 
        valedictorianName={classSummary?.valedictorian?.name} 
        salutatorianName={classSummary?.salutatorian?.name} 
      />
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/students')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">Hồ sơ Thí sinh</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Chi tiết năng lực và kết quả làm bài
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        <div className="space-y-6">
          <Card className="p-6 relative overflow-hidden">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Thông tin cá nhân</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Họ và tên</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{student.name}</p>
              </div>
              {/* Note: Email is hidden as per requirement */}
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
                <Radar name="Điểm của thí sinh" dataKey="Điểm của thí sinh" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
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
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Đánh giá chung</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Dựa trên kết quả ma trận kiến thức, giáo viên có thể hỗ trợ thí sinh tập trung cải thiện các phần kiến thức tương ứng với các câu trả lời sai (Màu đỏ).
                  </p>
                </div>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
