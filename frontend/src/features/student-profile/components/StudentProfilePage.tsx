import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User, Loader2, ShieldAlert } from "lucide-react";
import Button from "../../../components/ui/Button";
import { PageTransition } from "../../../components/ui/PageTransition";
import VActProgressCard from "../../../components/student-profile/VActProgressCard";
import VActRadarCard from "../../../components/student-profile/VActRadarCard";
import ActivityHeatmapCard from "../../../components/student-profile/ActivityHeatmapCard";
import KnowledgeNetworkCard from "../../../components/student-profile/KnowledgeNetworkCard";
import { getProfileSummary, StudentProfileSummary } from "../../../api/studentProfile";
import { Tabs, TabList, TabTrigger, TabContent } from "../../../components/ui/Tabs";
import { useAuth } from "../../../stores/authStore";

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const studentId = id ? Number(id) : user?.id;

  const [summary, setSummary] = useState<StudentProfileSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    const load = async () => {
      try {
        const data = await getProfileSummary(studentId);
        setSummary(data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [studentId]);

  if (!studentId) {
    return <div className="text-center p-8">Không tìm thấy thông tin học sinh</div>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!summary) {
    return <div>Không tìm thấy thông tin hồ sơ</div>;
  }

  const { student, can_view_answers_default } = summary;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="-ml-2 text-slate-500 hover:text-slate-900" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
          </Button>
        </div>
        
        {!can_view_answers_default && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-sm font-semibold">
            <ShieldAlert className="w-4 h-4" /> Bị khoá quyền xem đáp án
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mb-2">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
          <User className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {student.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-700">
              {student.class_label || "Chưa xếp lớp"}
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="progress" className="w-full">
        <TabList className="flex gap-2 mb-6">
          <TabTrigger value="progress">
            Tiến độ
          </TabTrigger>
          <TabTrigger value="network">
            Mạng lưới kiến thức
          </TabTrigger>
        </TabList>

        <TabContent value="progress">
          {/* Main grid: progress left, radar right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (Progress & Heatmap) */}
            <div className="lg:col-span-8 space-y-6">
              <VActProgressCard studentId={studentId} />
              <ActivityHeatmapCard studentId={studentId} />
            </div>
            {/* Right Column (Radar) */}
            <div className="lg:col-span-4">
              <VActRadarCard studentId={studentId} />
            </div>
          </div>
        </TabContent>

        <TabContent value="network">
          {/* Knowledge Network — full width */}
          <KnowledgeNetworkCard studentId={studentId} />
        </TabContent>
      </Tabs>

    </PageTransition>
  );
}
