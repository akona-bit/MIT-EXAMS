import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User, Loader2, ShieldAlert, BarChart3, Network } from "lucide-react";
import Button from "../../../components/ui/Button";
import { PageTransition } from "../../../components/ui/PageTransition";
import VActProgressCard from "../../../components/student-profile/VActProgressCard";
import VActRadarCard from "../../../components/student-profile/VActRadarCard";
import ActivityHeatmapCard from "../../../components/student-profile/ActivityHeatmapCard";
import KnowledgeNetworkCard from "../../../components/student-profile/KnowledgeNetworkCard";
import { getProfileSummary, StudentProfileSummary } from "../../../api/studentProfile";
import { Tabs, TabList, TabTrigger, TabContent } from "../../../components/ui/Tabs";
import { useAuth } from "../../../stores/authStore";
import { motion } from "framer-motion";

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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        <p className="text-sm text-slate-500 font-medium">Đang tải hồ sơ...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-slate-500">Không tìm thấy thông tin hồ sơ</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
        </Button>
      </div>
    );
  }

  const { student, can_view_answers_default } = summary;

  return (
    <PageTransition className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary-500/20 shrink-0">
              <User className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                {student.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {student.class_label || "Chưa xếp lớp"}
                </span>
                {!can_view_answers_default && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="w-3 h-3" /> Khóa đáp án
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="progress" className="w-full">
          <TabList className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl inline-flex">
            <TabTrigger value="progress" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Tiến độ
            </TabTrigger>
            <TabTrigger value="network" className="flex items-center gap-2">
              <Network className="w-4 h-4" /> Mạng lưới kiến thức
            </TabTrigger>
          </TabList>

          <TabContent value="progress">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-6">
                <VActProgressCard studentId={studentId} />
                <ActivityHeatmapCard studentId={studentId} />
              </div>
              <div className="lg:col-span-4">
                <VActRadarCard studentId={studentId} />
              </div>
            </div>
          </TabContent>

          <TabContent value="network">
            <KnowledgeNetworkCard studentId={studentId} />
          </TabContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
