import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExam, publishExam, getExamForms } from '../../api/exams';
import { runIrtCalibration, getIrtTaskStatus } from '../../api/grading';
import { getExamOverview, getExamItemsAnalysis, type ExamOverview, type ExamItemAnalysis } from '../../api/statistics';
import type { Exam } from '../../types';
import Button from '../../components/ui/Button';
import GenerateExamModal from '../../components/admin/GenerateExamModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { toast } from '../../components/ui/Toast';

export default function ExamDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasExistingForms, setHasExistingForms] = useState(false);
  
  const [irtTaskId, setIrtTaskId] = useState<string | null>(null);
  const [irtStatus, setIrtStatus] = useState<string | null>(null);
  
  const [overview, setOverview] = useState<ExamOverview | null>(null);
  const [itemsAnalysis, setItemsAnalysis] = useState<ExamItemAnalysis[] | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'irt'>('info');

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'publish' | 'irt' | null>(null);

  const fetchExamData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const examData = await getExam(parseInt(id));
      setExam(examData);
      
      const forms = await getExamForms(parseInt(id));
      setHasExistingForms(forms.length > 0);
      
      if (examData.status === 'FINISHED' || examData.status === 'PUBLISHED') {
         try {
           const [ov, items] = await Promise.all([
             getExamOverview(parseInt(id)),
             getExamItemsAnalysis(parseInt(id))
           ]);
           setOverview(ov);
           setItemsAnalysis(items);
         } catch (e) {
           console.error("Lỗi lấy thống kê:", e);
         }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExamData();
  }, [id]);

  useEffect(() => {
    if (!irtTaskId || irtStatus === 'SUCCESS' || irtStatus === 'FAILED') return;
    
    const interval = setInterval(async () => {
      try {
        const res = await getIrtTaskStatus(irtTaskId);
        setIrtStatus(res.status);
        if (res.status === 'SUCCESS' || res.status === 'FAILED') {
          clearInterval(interval);
          if (res.status === 'SUCCESS') {
            toast.success('Chấm điểm IRT hoàn tất!');
            fetchExamData();
          } else {
            toast.error('Chấm điểm IRT thất bại!');
          }
        }
      } catch (error) {
         console.error("Lỗi poll IRT status", error);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [irtTaskId, irtStatus]);

  const handleGenerate = () => {
    if (!exam?.matrix_id) {
      toast.warning("Kỳ thi này chưa được gắn ma trận đặc tả. Hãy chọn ma trận trước khi sinh đề.");
      return;
    }
    setIsGenerateModalOpen(true);
  };

  const handlePublish = () => {
    setConfirmAction('publish');
  };

  const handleRunIrt = () => {
    setConfirmAction('irt');
  };

  const confirmActionExecute = async () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (!id || !action) return;
    try {
      if (action === 'publish') {
        await publishExam(parseInt(id));
        toast.success('Đã xuất bản!');
        fetchExamData();
      } else {
        const res = await runIrtCalibration(parseInt(id));
        setIrtTaskId(res.task_id);
        setIrtStatus('PENDING');
      }
    } catch (error) {
      toast.error(action === 'publish' ? 'Lỗi xuất bản' : 'Lỗi chạy IRT');
    }
  };

  if (isLoading) return <div>Đang tải...</div>;
  if (!exam) return <div>Không tìm thấy kỳ thi</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-gradient pb-1">{exam.name}</h1>
        <Button variant="ghost" onClick={() => navigate('/admin/exams')}>Quay lại</Button>
      </div>

      <div className="flex border-b border-slate-200 dark:border-white/10">
        <button
          className={`px-4 py-3 font-semibold text-sm transition-colors ${activeTab === 'info' ? 'text-primary-600 border-b-2 border-primary-600 dark:text-primary-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('info')}
        >
          Thông tin chung
        </button>
        <button
          className={`px-4 py-3 font-semibold text-sm transition-colors ${activeTab === 'irt' ? 'text-primary-600 border-b-2 border-primary-600 dark:text-primary-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('irt')}
        >
          Kết quả IRT & Thống kê
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {activeTab === 'info' ? (
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Chi tiết kỳ thi</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div className="space-y-1">
                  <p className="text-slate-500 dark:text-slate-400">Trạng thái</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{exam.status}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500 dark:text-slate-400">Thời gian làm bài</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{exam.duration_minutes !== null ? `${exam.duration_minutes} phút` : "Không giới hạn"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500 dark:text-slate-400">ID Ma trận</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{exam.matrix_id || <span className="text-danger-500 italic">Chưa cấu hình</span>}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Tổng quan</h3>
                {overview ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                      <div className="text-slate-500 dark:text-slate-400 mb-1">Số lượng</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">{overview.total_participants}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                      <div className="text-slate-500 dark:text-slate-400 mb-1">Điểm TB</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">{overview.average_score}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                      <div className="text-slate-500 dark:text-slate-400 mb-1">Điểm cao nhất</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">{overview.max_score}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                      <div className="text-slate-500 dark:text-slate-400 mb-1">Điểm thấp nhất</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">{overview.min_score}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">Chưa có dữ liệu thống kê.</p>
                )}
              </div>
              
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Phân tích chất lượng câu hỏi (IRT)</h3>
                {itemsAnalysis && itemsAnalysis.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-white/10">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">ID</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Độ khó (b)</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Phân biệt (a)</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Cảnh báo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {itemsAnalysis.map(item => (
                          <tr key={item.question_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-medium">{item.question_id}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.difficulty_b}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.discrimination_a}</td>
                            <td className="px-4 py-3">
                              {item.warning_flags.map(f => (
                                <span key={f} className="inline-block bg-danger-500/10 text-danger-600 dark:text-danger-400 border border-danger-500/20 text-xs px-2 py-1 rounded-md mr-1">{f}</span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">Chưa có phân tích câu hỏi. Hãy chạy chấm điểm IRT.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="glass-card p-6 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Thao tác</h3>
            {exam.status === 'DRAFT' && (
              <>
                <div title={!exam.matrix_id ? "Kỳ thi chưa gắn ma trận" : ""}>
                  <Button 
                    variant="outline" 
                    onClick={handleGenerate} 
                    className="w-full justify-center"
                    disabled={!exam.matrix_id}
                  >
                    Sinh mã đề thi
                  </Button>
                </div>
                <Button variant="default" onClick={handlePublish} className="w-full justify-center shadow-lg shadow-primary-500/20">Xuất bản (Publish)</Button>
              </>
            )}
            {(exam.status === 'PUBLISHED' || exam.status === 'FINISHED') && (
              <>
                <Button variant="default" onClick={handleRunIrt} disabled={!!irtStatus && irtStatus !== 'SUCCESS' && irtStatus !== 'FAILED'} className="w-full justify-center shadow-lg shadow-primary-500/20">
                  {irtStatus === 'PENDING' || irtStatus === 'STARTED' ? `Đang chạy IRT... (${irtStatus})` : 'Chạy phân tích IRT'}
                </Button>
              </>
            )}
            {hasExistingForms && (
                <Button variant="outline" onClick={() => {
                  import('../../api/exams').then(api => api.exportExamLaTeX(exam.id));
                }} className="w-full justify-center">
                  Xuất Đề (LaTeX)
                </Button>
            )}
            {exam.status === 'PUBLISHED' && (
              <Button variant="secondary" disabled className="w-full justify-center">Đang diễn ra</Button>
            )}
          </div>
        </div>
      </div>
      
      <GenerateExamModal 
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        examId={exam.id}
        matrixId={exam.matrix_id}
        hasExistingForms={hasExistingForms}
        onSuccess={fetchExamData}
      />

      <ConfirmDialog
        isOpen={confirmAction !== null}
        title={confirmAction === 'irt' ? 'Chạy phân tích IRT?' : 'Xuất bản kỳ thi?'}
        message={
          confirmAction === 'irt'
            ? 'Hệ thống sẽ khởi chạy tiến trình phân tích IRT và quy đổi điểm chuẩn. Quá trình chạy nền (Celery) và có thể mất vài phút.'
            : 'Học sinh sẽ có thể tham gia kỳ thi này sau khi xuất bản.'
        }
        confirmText={confirmAction === 'irt' ? 'Chạy IRT' : 'Xuất bản'}
        onConfirm={confirmActionExecute}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
