import React, { useState } from 'react';
import { X, MessageSquare, AlertCircle, FileText, Send, Loader2 } from 'lucide-react';
import { studentFeedbacksApi } from '../../api/studentFeedbacks';
import { Button } from '../ui/Button';

interface StudentFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  examSessionId?: string;
}

export function StudentFeedbackModal({ isOpen, onClose, examSessionId }: StudentFeedbackModalProps) {
  const [category, setCategory] = useState<'BUG' | 'EXAM_CONTENT' | 'OTHER'>('BUG');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Vui lòng nhập nội dung góp ý');
      return;
    }
    if (content.length > 2000) {
      setError('Nội dung góp ý không được vượt quá 2000 ký tự');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await studentFeedbacksApi.create({
        category,
        content,
        context_data: {
          url: window.location.href,
          exam_session_id: examSessionId,
        },
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setContent('');
        setCategory('BUG');
        onClose();
      }, 2500);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Có lỗi xảy ra khi gửi góp ý. Vui lòng thử lại sau.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white font-semibold">
            <MessageSquare className="w-5 h-5 text-primary-500" />
            Góp ý / Báo lỗi
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">Gửi thành công!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Cảm ơn bạn đã đóng góp ý kiến. Chúng tôi sẽ ghi nhận và xử lý sớm nhất.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Phân loại
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                      category === 'BUG'
                        ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value="BUG"
                      checked={category === 'BUG'}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="sr-only"
                    />
                    <AlertCircle className="w-4 h-4" />
                    Lỗi web
                  </label>
                  <label
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                      category === 'EXAM_CONTENT'
                        ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value="EXAM_CONTENT"
                      checked={category === 'EXAM_CONTENT'}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="sr-only"
                    />
                    <FileText className="w-4 h-4" />
                    Lỗi đề thi
                  </label>
                  <label
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                      category === 'OTHER'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value="OTHER"
                      checked={category === 'OTHER'}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="sr-only"
                    />
                    Khác
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex justify-between">
                  <span>Nội dung chi tiết</span>
                  <span className={`text-xs ${content.length > 2000 ? 'text-red-500' : 'text-slate-400'}`}>
                    {content.length}/2000
                  </span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    category === 'EXAM_CONTENT'
                      ? 'Ví dụ: Câu 15 phần Toán sai đáp án, câu hỏi có hình ảnh bị lỗi...'
                      : category === 'BUG'
                      ? 'Mô tả lỗi bạn gặp phải. Kèm theo các bước để tái tạo lỗi nếu có thể...'
                      : 'Nhập nội dung góp ý của bạn...'
                  }
                  rows={5}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Hủy
              </Button>
              <Button type="submit" isLoading={isSubmitting} className="gap-2">
                <Send className="w-4 h-4" />
                Gửi góp ý
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
