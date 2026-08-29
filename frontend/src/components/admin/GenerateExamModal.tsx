import { useState, useEffect } from 'react';
import { generateExamFromMatrix } from '../../api/exams';
import Button from '../ui/Button';
import { X, AlertTriangle, FileText, Settings, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';

interface GenerateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: number;
  matrixId: number;
  hasExistingForms: boolean;
  onSuccess: () => void;
}

export default function GenerateExamModal({
  isOpen,
  onClose,
  examId,
  matrixId,
  hasExistingForms,
  onSuccess
}: GenerateExamModalProps) {
  const [numForms, setNumForms] = useState<number>(4);
  const [distinctQuestions, setDistinctQuestions] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorShortages, setErrorShortages] = useState<string[]>([]);

  // Reset errors when inputs change
  useEffect(() => {
    setErrorShortages([]);
  }, [numForms, distinctQuestions]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) return;
    
    setIsGenerating(true);
    setErrorShortages([]);
    
    try {
      await generateExamFromMatrix(matrixId, {
        exam_id: examId,
        number_of_forms: numForms,
        distinct_questions: distinctQuestions
      });
      alert('Tạo mã đề thành công!');
      onSuccess();
      onClose();
    } catch (error: any) {
      if (error.response?.status === 422 && error.response.data?.detail?.shortages) {
        setErrorShortages(error.response.data.detail.shortages);
      } else {
        alert(error.response?.data?.detail?.message || 'Có lỗi xảy ra khi tạo mã đề.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-white/10 animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-500/10">
              <Settings className="h-5 w-5 text-primary-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sinh Mã Đề Thi</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Tự động chọn câu hỏi từ ngân hàng</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            
            {hasExistingForms && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400">Cảnh báo ghi đè</h4>
                  <p className="text-sm text-amber-700/80 dark:text-amber-400/80 mt-1">
                    Kỳ thi này đã có sẵn mã đề. Nếu bạn tiếp tục sinh đề, hệ thống sẽ <strong>tạo thêm</strong> mã đề mới thay vì xóa các mã đề cũ.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Số lượng mã đề cần sinh
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numForms}
                  onChange={(e) => setNumForms(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all dark:text-white"
                  disabled={isGenerating}
                  required
                />
              </div>

              <label className={cn(
                "flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer",
                distinctQuestions 
                  ? "bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/30" 
                  : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10"
              )}>
                <div className="flex items-center h-5 mt-0.5">
                  <input
                    type="checkbox"
                    checked={distinctQuestions}
                    onChange={(e) => setDistinctQuestions(e.target.checked)}
                    className="w-4 h-4 text-primary-600 bg-white border-slate-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                    disabled={isGenerating}
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-500" />
                    Ưu tiên câu hỏi khác nhau
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Thuật toán sẽ cố gắng chọn các bộ câu hỏi hoàn toàn khác nhau cho mỗi mã đề (nếu ngân hàng đủ số lượng). Nếu tắt, các mã đề sẽ dùng chung một bộ câu hỏi nhưng được xáo trộn ngẫu nhiên.
                  </p>
                </div>
              </label>
            </div>

            {/* Lỗi Thiếu Câu Hỏi */}
            {errorShortages.length > 0 && (
              <div className="p-4 bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/20 rounded-xl animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-danger-600 dark:text-danger-400 font-semibold mb-3">
                  <AlertTriangle className="w-5 h-5" />
                  Không đủ câu hỏi trong ngân hàng!
                </div>
                <ul className="list-disc list-inside text-sm text-danger-700/90 dark:text-danger-400/90 space-y-1.5 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {errorShortages.map((err, idx) => (
                    <li key={idx} className="leading-relaxed">{err}</li>
                  ))}
                </ul>
                <div className="mt-3 text-xs text-danger-600/70 dark:text-danger-400/70 italic">
                  Vui lòng thêm câu hỏi vào ngân hàng hoặc giảm yêu cầu của Ma trận.
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-6 pt-0 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={isGenerating} type="button">
              Hủy bỏ
            </Button>
            <Button type="submit" disabled={isGenerating} className="min-w-[140px]">
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Đang tạo...
                </span>
              ) : (
                'Xác nhận sinh đề'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
