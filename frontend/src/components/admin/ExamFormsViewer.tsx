import { useState, useEffect } from 'react';
import { getExamFormsDetail } from '../../api/exams';
import type { ExamFormDetail } from '../../types';
import Modal from '../ui/Modal';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface ExamFormsViewerProps {
  isOpen: boolean;
  onClose: () => void;
  examId: number;
  examName: string;
}

const PART_LABELS: Record<number, string> = {
  1: 'Phần 1.1: Tiếng Việt',
  2: 'Phần 1.2: Tiếng Anh',
  3: 'Phần 2: Toán học',
  4: 'Phần 3: Tư duy khoa học',
};

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];
const answerLabel = (pos: number) => ANSWER_LABELS[pos - 1] ?? String(pos);

export default function ExamFormsViewer({ isOpen, onClose, examId, examName }: ExamFormsViewerProps) {
  const [forms, setForms] = useState<ExamFormDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'detail' | 'compare'>('list');
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set([1, 2, 3, 4]));
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    getExamFormsDetail(examId)
      .then((data) => {
        setForms(data);
        if (data.length > 0 && !selectedFormId) {
          setSelectedFormId(data[0].id);
        }
      })
      .catch(() => setForms([]))
      .finally(() => setIsLoading(false));
  }, [examId, isOpen]);

  const selectedForm = forms.find((f) => f.id === selectedFormId);

  const togglePart = (part: number) => {
    setExpandedParts((prev) => {
      const next = new Set(prev);
      if (next.has(part)) next.delete(part);
      else next.add(part);
      return next;
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const getUniqueQuestionCount = () => {
    const allQids = new Set<number>();
    forms.forEach((f) => f.questions.forEach((q) => allQids.add(q.question_id)));
    return allQids.size;
  };

  const renderDetailTab = () => {
    if (!selectedForm) return <p className="text-slate-500 p-4">Chưa chọn mã đề.</p>;

    const grouped: Record<number, typeof selectedForm.questions> = {};
    selectedForm.questions.forEach((q) => {
      if (!grouped[q.part]) grouped[q.part] = [];
      grouped[q.part].push(q);
    });

    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-slate-500">Chọn mã đề:</span>
          <select
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800"
            value={selectedFormId ?? ''}
            onChange={(e) => setSelectedFormId(Number(e.target.value))}
          >
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code} {f.is_original ? '(Gốc)' : '(Xáo)'}
              </option>
            ))}
          </select>
        </div>

        {[1, 2, 3, 4].map((part) => {
          const questions = grouped[part] || [];
          const isExpanded = expandedParts.has(part);
          return (
            <div key={part} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <button
                onClick={() => togglePart(part)}
                className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                  {PART_LABELS[part]}
                </span>
                <span className="text-xs text-slate-400 ml-auto">{questions.length} câu</span>
              </button>
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 w-12">Vị trí</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 w-20">QID</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Nội dung</th>
                        <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400 w-40">Sơ đồ xáo</th>
                        <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400 w-20">Đáp án đúng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {questions.map((q) => {
                        const byOrigPos = q.answers.slice().sort((a, b) => a.original_position - b.original_position);
                        const correctAnswers = q.answers.filter((a) => a.is_correct);
                        // Có vị trí gốc tin cậy cho đủ các đáp án → hiện sơ đồ xáo A→C;
                        // nếu thiếu (dữ liệu cũ position=0) → chỉ hiện chữ cái mới.
                        const hasFullOrigPos = byOrigPos.length > 0 && byOrigPos.every((a) => a.original_position > 0);
                        return (
                        <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">{q.position}</td>
                          <td className="px-3 py-2 font-mono text-primary-600 dark:text-primary-400">{q.question_id}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                            {q.question_content || '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {byOrigPos.map((a) => (
                                <span
                                  key={a.id}
                                  title={a.content ?? undefined}
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono font-semibold border ${
                                    a.is_correct
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700'
                                      : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                  }`}
                                >
                                  {hasFullOrigPos ? `${answerLabel(a.original_position)}→${answerLabel(a.new_position)}` : answerLabel(a.new_position)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {correctAnswers.length > 0 ? correctAnswers.map((a) => (
                                <span
                                  key={a.id}
                                  title={a.content ?? undefined}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold"
                                >
                                  <Check className="w-3 h-3" strokeWidth={3} />
                                  {answerLabel(a.new_position)}
                                </span>
                              )) : <span className="text-slate-400">—</span>}
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCompareTab = () => {
    if (forms.length < 2) return <p className="text-slate-500 p-4">Cần ít nhất 2 mã đề để so sánh.</p>;

    const shuffledForms = forms.filter((f) => !f.is_original);
    const displayForms = shuffledForms.length >= 2 ? shuffledForms : forms;
    const formCodes = displayForms.map((f) => f.code);

    const questionMap = new Map<number, Map<string, number>>();
    displayForms.forEach((form) => {
      form.questions.forEach((q) => {
        if (!questionMap.has(q.question_id)) {
          questionMap.set(q.question_id, new Map());
        }
        questionMap.get(q.question_id)!.set(form.code, q.position);
      });
    });

    const allQuestionIds = Array.from(questionMap.keys()).sort((a, b) => a - b);

    const getPartForQuestion = (qid: number): number => {
      for (const form of displayForms) {
        const q = form.questions.find((x) => x.question_id === qid);
        if (q) return q.part;
      }
      return 0;
    };

    return (
      <div className="p-4">
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 w-20 border-b border-slate-200 dark:border-slate-700">QID gốc</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400 w-16 border-b border-slate-200 dark:border-slate-700">Phần</th>
                {formCodes.map((code) => (
                  <th key={code} className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 min-w-[60px]">
                    {code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {allQuestionIds.map((qid) => {
                const part = getPartForQuestion(qid);
                const partBg = part === 1 ? 'bg-blue-50/30 dark:bg-blue-900/10' :
                               part === 2 ? 'bg-green-50/30 dark:bg-green-900/10' :
                               part === 3 ? 'bg-amber-50/30 dark:bg-amber-900/10' :
                               'bg-purple-50/30 dark:bg-purple-900/10';
                return (
                  <tr key={qid} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${partBg}`}>
                    <td className="px-3 py-2 font-mono text-primary-600 dark:text-primary-400">{qid}</td>
                    <td className="px-3 py-2 text-center text-slate-500">{part}</td>
                    {formCodes.map((code) => {
                      const pos = questionMap.get(qid)?.get(code);
                      return (
                        <td key={code} className="px-3 py-2 text-center font-mono text-slate-700 dark:text-slate-300">
                          {pos ?? '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Mã đề - ${examName}`} maxWidth="max-w-5xl">
      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Đang tải dữ liệu mã đề...</div>
      ) : forms.length === 0 ? (
        <div className="p-8 text-center text-slate-500">Chưa có mã đề nào được tạo.</div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === 'list'
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Danh sách ({forms.length})
              </button>
              <button
                onClick={() => setActiveTab('detail')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === 'detail'
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Chi tiết câu hỏi
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === 'compare'
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                So sánh mã đề
              </button>
            </div>
            <div className="ml-auto text-xs text-slate-400">
              {getUniqueQuestionCount()} câu hỏi gốc
            </div>
          </div>

          {activeTab === 'list' && (
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {forms.map((form) => (
                  <div
                    key={form.id}
                    className={`border rounded-xl p-4 transition-all cursor-pointer ${
                      selectedFormId === form.id
                        ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                    onClick={() => {
                      setSelectedFormId(form.id);
                      setActiveTab('detail');
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-lg text-slate-900 dark:text-white">{form.code}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyCode(form.code);
                        }}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Copy mã đề"
                      >
                        {copiedCode === form.code ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className={`px-2 py-0.5 rounded-full ${
                        form.is_original
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {form.is_original ? 'Gốc' : 'Xáo'}
                      </span>
                      <span>{form.question_count} câu</span>
                      <span className="ml-auto">{new Date(form.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'detail' && renderDetailTab()}
          {activeTab === 'compare' && renderCompareTab()}
        </>
      )}
    </Modal>
  );
}
