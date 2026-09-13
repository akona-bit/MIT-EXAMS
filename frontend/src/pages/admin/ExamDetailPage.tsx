import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExam, publishExam, getExamForms, updateExam, uploadExamPdf } from '../../api/exams';
import { runIrtCalibration, getIrtTaskStatus } from '../../api/grading';
import { getExamOverview, getExamItemsAnalysis, type ExamOverview, type ExamItemAnalysis } from '../../api/statistics';
import { generateCredentials } from '../../api/exams';
import type { Exam } from '../../types';
import Button from '../../components/ui/Button';
import GenerateExamModal from '../../components/admin/GenerateExamModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { toast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import IrtTerminalModal from '../../components/admin/IrtTerminalModal';
import { Printer, Upload, FileText, ExternalLink, ListOrdered, Users, BarChart3, TrendingUp, ArrowDown, FlaskConical, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { PrintPreviewModal, AnswerSheetPreview } from '../../components/print';

// Nhãn + màu Badge cho từng loại cảnh báo câu hỏi (theo ui-tokens.md semantic colors)
const FLAG_META: Record<string, { label: string; variant: 'destructive' | 'warning' | 'info' }> = {
  POOR_DISCRIMINATION: { label: 'Phân biệt kém', variant: 'destructive' },
  TOO_HARD: { label: 'Quá khó', variant: 'warning' },
  TOO_EASY: { label: 'Quá dễ', variant: 'info' },
  MODEL_MISFIT: { label: 'Lệch model', variant: 'warning' },
};
import ExamFormsViewer from '../../components/admin/ExamFormsViewer';

export default function ExamDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasExistingForms, setHasExistingForms] = useState(false);
  
  const [irtTaskId, setIrtTaskId] = useState<string | null>(null);
  const [irtStatus, setIrtStatus] = useState<string | null>(null);
  const [irtLogs, setIrtLogs] = useState<{time: string, msg: string}[]>([]);
  const [isIrtModalOpen, setIsIrtModalOpen] = useState(false);
  
  const [overview, setOverview] = useState<ExamOverview | null>(null);
  const [itemsAnalysis, setItemsAnalysis] = useState<ExamItemAnalysis[] | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'irt' | 'files'>('info');

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'publish' | 'irt' | null>(null);
  const [formsCount, setFormsCount] = useState(0);

  const [isGeneratingCredentials, setIsGeneratingCredentials] = useState(false);
  const [isExportingLaTeX, setIsExportingLaTeX] = useState(false);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [credentialsList, setCredentialsList] = useState<any[]>([]);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Print Preview state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isFormsViewerOpen, setIsFormsViewerOpen] = useState(false);

  const fetchExamData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const examData = await getExam(parseInt(id));
      setExam(examData);
      
      const forms = await getExamForms(parseInt(id));
      setHasExistingForms(forms.length > 0);
      setFormsCount(forms.length);
      
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
        if (res.logs) {
          setIrtLogs(res.logs);
        }
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

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !exam) return;
    
    if (!file.name.endsWith('.pdf')) {
      toast.error("Chỉ chấp nhận file PDF");
      return;
    }
    
    setIsUploadingPdf(true);
    try {
      const result = await uploadExamPdf(exam.id, file);
      setExam({ ...exam, exam_pdf_url: result.url });
      toast.success("Tải file PDF bài thi thành công!");
    } catch (error) {
      toast.error("Lỗi khi tải file PDF lên");
    } finally {
      setIsUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
        setIrtLogs([]);
        setIsIrtModalOpen(true);
      }
    } catch (error) {
      toast.error(action === 'publish' ? 'Lỗi xuất bản' : 'Lỗi chạy IRT');
    }
  };

  if (isLoading) return <div>Đang tải...</div>;
  if (!exam) return <div>Không tìm thấy kỳ thi</div>;

  // Tổng hợp cảnh báo câu hỏi (dải cảnh báo nổi bật phía trên bảng — ui-rules.md)
  const flagCounts = (itemsAnalysis ?? []).reduce<Record<string, number>>((acc, it) => {
    for (const f of it.warning_flags) acc[f] = (acc[f] || 0) + 1;
    return acc;
  }, {});
  const flaggedCount = (itemsAnalysis ?? []).filter(it => it.warning_flags.length > 0).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-gradient pb-1">{exam.name}</h1>
        <Button variant="ghost" onClick={() => navigate('/admin/exams')}>Quay lại</Button>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <button
          className={`px-4 py-3 font-semibold text-sm transition-colors ${activeTab === 'info' ? 'text-primary-600 border-b-2 border-primary-600 dark:text-primary-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('info')}
        >
          Thông tin chung
        </button>
        <button
          className={`px-4 py-3 font-semibold text-sm transition-colors ${activeTab === 'files' ? 'text-primary-600 border-b-2 border-primary-600 dark:text-primary-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('files')}
        >
          File thi
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
          {activeTab === 'info' && (
            <div className="p-6">
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
                  <p className="text-slate-500 dark:text-slate-400">Số lần thi tối đa</p>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{exam.max_attempts !== null ? `${exam.max_attempts} lần` : "Không giới hạn"}</p>
                    {exam.status === 'DRAFT' && (
                      <button
                        onClick={async () => {
                          const val = prompt('Nhập số lần thi tối đa (để trống nếu không giới hạn):', exam.max_attempts?.toString() || '');
                          if (val !== null) {
                            try {
                              const max_attempts = val.trim() === '' ? null : parseInt(val, 10);
                              await updateExam(exam.id, { max_attempts });
                              toast.success('Đã cập nhật số lần thi');
                              fetchExamData();
                            } catch (e) {
                              toast.error('Cập nhật thất bại');
                            }
                          }
                        }}
                        className="text-xs font-medium text-primary-600 hover:underline"
                      >
                        Sửa
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500 dark:text-slate-400">ID Ma trận</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{exam.matrix_id || <span className="text-danger-500 italic">Chưa cấu hình</span>}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500 dark:text-slate-400">Số mã đề đã tạo</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{formsCount > 0 ? `${formsCount} mã đề` : <span className="text-danger-500 italic">Chưa sinh đề</span>}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500 dark:text-slate-400">Hình thức làm bài</p>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Làm trên máy {exam.allow_omr ? "& trên giấy (OMR)" : "chỉ trực tuyến"}
                    </span>
                    {exam.status === 'DRAFT' && (
                      <button
                        onClick={async () => {
                          try {
                            await updateExam(exam.id, { allow_omr: !exam.allow_omr });
                            fetchExamData();
                            toast.success(`Đã ${!exam.allow_omr ? 'bật' : 'tắt'} chức năng nộp bài OMR`);
                          } catch (err) {
                            toast.error("Không thể cập nhật cấu hình OMR");
                          }
                        }}
                        className="text-xs px-2 py-1 bg-primary-50 text-primary-600 rounded-md hover:bg-primary-100 transition-colors"
                      >
                        {exam.allow_omr ? "Tắt OMR" : "Bật OMR"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">File bài thi</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleUploadPdf}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPdf}
                    className="flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {isUploadingPdf ? "Đang tải lên..." : "Tải file PDF lên"}
                  </Button>
                  <span className="text-xs text-slate-500">Chỉ chấp nhận file PDF, tối đa 50MB</span>
                </div>

                {exam.exam_pdf_url ? (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">PDF bài thi</p>
                          <p className="text-xs text-slate-500">Đã tải lên</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={exam.exam_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Mở
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
                    <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400">Chưa có file PDF bài thi</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Tải lên file PDF để thí sinh có thể xem đề thi khi làm bài OMR</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'irt' && (
            <div className="space-y-6">
              <div className="p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tổng quan</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Kết quả chấm điểm toàn kỳ thi — thang điểm 1200</p>
                </div>
                {overview && overview.has_data ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-500/10 shrink-0">
                            <Users className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">Số lượng</div>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                          {overview.total_participants}
                          <span className="ml-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">thí sinh</span>
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-500/10 shrink-0">
                            <BarChart3 className="h-4 w-4 text-info-600 dark:text-info-500" />
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">Điểm TB</div>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                          {overview.average_score}
                          <span className="ml-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">/ 1200</span>
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10 shrink-0">
                            <TrendingUp className="h-4 w-4 text-success-600 dark:text-success-500" />
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">Điểm cao nhất</div>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                          {overview.max_score}
                          <span className="ml-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">/ 1200</span>
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-500/10 shrink-0">
                            <ArrowDown className="h-4 w-4 text-warning-600 dark:text-warning-500" />
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">Điểm thấp nhất</div>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                          {overview.min_score}
                          <span className="ml-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">/ 1200</span>
                        </div>
                      </div>
                    </div>

                    {overview.distribution.some(d => d.count > 0) && (
                      <div className="mt-6">
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Phổ điểm</div>
                        <div className="h-56 -ml-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={overview.distribution} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#C7CCD4" strokeOpacity={0.5} />
                              <XAxis
                                dataKey="range"
                                tick={{ fontSize: 11, fill: '#8A93A3' }}
                                tickLine={false}
                                axisLine={{ stroke: '#C7CCD4' }}
                                interval={0}
                              />
                              <YAxis
                                allowDecimals={false}
                                tick={{ fontSize: 11, fill: '#8A93A3' }}
                                tickLine={false}
                                axisLine={false}
                                width={36}
                              />
                              <Tooltip
                                cursor={{ fill: 'rgba(45, 108, 255, 0.06)' }}
                                formatter={(value) => [`${value} thí sinh`, 'Số lượng']}
                              />
                              <Bar dataKey="count" name="Số lượng" fill="#2D6CFF" radius={[4, 4, 0, 0]} maxBarSize={48} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState
                    icon={<BarChart3 className="h-8 w-8 text-slate-400 dark:text-slate-500" />}
                    title="Chưa có dữ liệu thống kê"
                    message="Số liệu sẽ xuất hiện sau khi có thí sinh nộp bài và bài làm được chấm điểm."
                  />
                )}
              </div>
              
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Phân tích chất lượng câu hỏi (IRT)</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Tham số độ khó (b), độ phân biệt (a) ước lượng từ bài làm thực tế</p>
                  </div>
                  {itemsAnalysis && itemsAnalysis.length > 0 && itemsAnalysis[0].computed_at && (
                    <Badge variant="secondary" className="shrink-0">
                      Phân tích lúc {new Date(itemsAnalysis[0].computed_at).toLocaleString('vi-VN')}
                    </Badge>
                  )}
                </div>
                {itemsAnalysis && itemsAnalysis.length > 0 ? (
                  <>
                    {flaggedCount > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mb-4 px-3.5 py-2.5 rounded-lg bg-warning-500/5 border border-warning-500/20">
                        <AlertTriangle className="h-4 w-4 text-warning-600 dark:text-warning-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {flaggedCount}/{itemsAnalysis.length} câu cần lưu ý:
                        </span>
                        {Object.entries(flagCounts).map(([flag, count]) => {
                          const meta = FLAG_META[flag];
                          return (
                            <Badge key={flag} variant={meta?.variant ?? 'warning'}>
                              {meta?.label ?? flag} · {count}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">ID</th>
                            <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Độ khó (b)</th>
                            <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Phân biệt (a)</th>
                            <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">CTT (p đúng)</th>
                            <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">CTT (D-Index)</th>
                            <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Cảnh báo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {itemsAnalysis.map(item => (
                            <tr
                              key={item.question_id}
                              className={`transition-colors ${item.warning_flags.length > 0 ? 'bg-warning-500/[0.04] hover:bg-warning-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                              <td className="px-4 py-3 font-medium">{item.question_id}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">{item.difficulty_b ?? '—'}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">{item.discrimination_a ?? '—'}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">{item.ctt_difficulty !== null ? item.ctt_difficulty.toFixed(3) : '—'}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">{item.ctt_discrimination !== null ? item.ctt_discrimination.toFixed(3) : '—'}</td>
                              <td className="px-4 py-3">
                                {item.warning_flags.length > 0 ? item.warning_flags.map(f => (
                                  <Badge key={f} variant={FLAG_META[f]?.variant ?? 'warning'} className="mr-1 mb-0.5">
                                    {FLAG_META[f]?.label ?? f}
                                  </Badge>
                                )) : (
                                  <Badge variant="success">Ổn định</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={<FlaskConical className="h-8 w-8 text-slate-400 dark:text-slate-500" />}
                    title="Chưa chạy phân tích IRT cho kỳ thi này"
                    message="Chạy phân tích IRT để calibrate tham số độ khó (b) và độ phân biệt (a) từ bài làm thực tế của kỳ thi này. Yêu cầu ít nhất 200 bài làm đã được chấm điểm."
                    action={
                      <Button variant="default" onClick={handleRunIrt} className="shadow-lg shadow-primary-500/20">
                        Chạy phân tích IRT
                      </Button>
                    }
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="p-6 flex flex-col gap-4">
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
                <Button
                  variant="default"
                  onClick={() => {
                    // Đang chạy: bấm để mở lại terminal tiến trình (polling vẫn chạy nền)
                    if (irtStatus === 'PENDING' || irtStatus === 'STARTED') {
                      setIsIrtModalOpen(true);
                      return;
                    }
                    handleRunIrt();
                  }}
                  className="w-full justify-center shadow-lg shadow-primary-500/20"
                >
                  {irtStatus === 'PENDING' || irtStatus === 'STARTED'
                    ? 'Đang chạy IRT — xem tiến trình'
                    : 'Chạy phân tích IRT'}
                </Button>
              </>
            )}
            {hasExistingForms && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (isExportingLaTeX) return;
                    setIsExportingLaTeX(true);
                    try {
                      const api = await import('../../api/exams');
                      await api.exportExamLaTeX(exam.id);
                      toast.success('Đã xuất đề (LaTeX). Tệp ZIP đang được tải về.');
                    } catch (error) {
                      toast.error('Không thể xuất đề LaTeX. Vui lòng thử lại.');
                    } finally {
                      setIsExportingLaTeX(false);
                    }
                  }}
                  disabled={isExportingLaTeX}
                  className="w-full justify-center"
                >
                  {isExportingLaTeX ? 'Đang xuất đề (LaTeX)...' : 'Xuất Đề (LaTeX)'}
                </Button>
            )}
            {hasExistingForms && (
                <Button
                  variant="outline"
                  onClick={() => setIsFormsViewerOpen(true)}
                  className="w-full justify-center text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100"
                >
                  <ListOrdered className="w-4 h-4 mr-2" /> Xem mã đề
                </Button>
            )}
            {hasExistingForms && (
                <Button
                  variant="outline"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="w-full justify-center text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100"
                >
                  <Printer className="w-4 h-4 mr-2" /> Phiếu trả lời
                </Button>
            )}
            {exam.status === 'PUBLISHED' && (
              <>
                <Button variant="secondary" disabled className="w-full justify-center">Đang diễn ra</Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!id) return;
                    setIsGeneratingCredentials(true);
                    try {
                      const data = await generateCredentials(parseInt(id));
                      setCredentialsList(data);
                      setIsCredentialsModalOpen(true);
                    } catch (error) {
                      toast.error("Không thể cấp SBD và mật khẩu.");
                    } finally {
                      setIsGeneratingCredentials(false);
                    }
                  }}
                  disabled={isGeneratingCredentials}
                  className="w-full justify-center"
                >
                  {isGeneratingCredentials ? "Đang xử lý..." : "Cấp SBD & Mật khẩu"}
                </Button>
              </>
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
            ? 'Hệ thống sẽ khởi chạy tiến trình phân tích IRT và quy đổi điểm chuẩn. Quá trình chạy nền (background task) và có thể mất vài phút.'
            : 'Học sinh sẽ có thể tham gia kỳ thi này sau khi xuất bản.'
        }
        confirmText={confirmAction === 'irt' ? 'Chạy IRT' : 'Xuất bản'}
        onConfirm={confirmActionExecute}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Credentials Modal */}
      <Modal isOpen={isCredentialsModalOpen} onClose={() => setIsCredentialsModalOpen(false)}>
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4">Danh sách SBD và Mật khẩu</h3>
          <p className="text-sm text-slate-500 mb-4">
            Vui lòng tải xuống hoặc copy danh sách này để gửi cho học sinh. Các học sinh không có mật khẩu mới sẽ sử dụng mật khẩu cá nhân của họ.
          </p>
          <div className="max-h-96 overflow-auto border border-slate-200 rounded-lg mb-4">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2">Họ Tên</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">SBD</th>
                  <th className="px-4 py-2">Mật khẩu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {credentialsList.map((c: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-2">{c.full_name}</td>
                    <td className="px-4 py-2">{c.email}</td>
                    <td className="px-4 py-2 font-mono">{c.sbd}</td>
                    <td className="px-4 py-2 font-mono text-primary-600">{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsCredentialsModalOpen(false)}>Đóng</Button>
            <Button 
              onClick={() => {
                const csvRows = [
                  ['Ho Ten', 'Email', 'SBD', 'Mat khau'],
                  ...credentialsList.map((c: any) => [c.full_name, c.email, c.sbd, c.password])
                ];
                const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
                  + csvRows.map(e => e.join(",")).join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `SBD_${exam.id}.csv`);
                document.body.appendChild(link);
                link.click();
              }}
            >
              Tải file CSV
            </Button>
          </div>
        </div>
      </Modal>

      {/* IRT Terminal Modal */}
      {isIrtModalOpen && (
        <IrtTerminalModal
          isOpen={isIrtModalOpen}
          onClose={() => setIsIrtModalOpen(false)}
          status={irtStatus}
          logs={irtLogs}
        />
      )}

      {/* Print Preview Modal */}
      <PrintPreviewModal
        open={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="Phiếu trả lời trắc nghiệm - Xem trước khi in"
      >
        <AnswerSheetPreview
          schoolName={exam?.name}
          examTitle={exam?.name}
        />
      </PrintPreviewModal>

      {/* Exam Forms Viewer Modal */}
      <ExamFormsViewer
        isOpen={isFormsViewerOpen}
        onClose={() => setIsFormsViewerOpen(false)}
        examId={exam.id}
        examName={exam.name}
      />

    </div>
  );
}
