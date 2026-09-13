import { useState, useEffect } from "react";
import { X, Lock, FileQuestion, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import Button from "../../../components/ui/Button";
import { getKnowledgeNodeDetail } from "../../../api/studentProfile";
import { AnimatePresence, motion } from "framer-motion";
import { KnowledgeMasteryItem } from "../../../api/studentProfile";
import DOMPurify from "dompurify";

interface DrawerProps {
  studentId: number;
  node: KnowledgeMasteryItem | null;
  onClose: () => void;
}

export function AnswerDetailDrawer({ studentId, node, onClose }: DrawerProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!node) {
      setData(null);
      return;
    }
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const detail = await getKnowledgeNodeDetail(studentId, node.knowledge_node_id);
        setData(detail);
      } catch (err) {
        console.error("Failed to load node detail", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [node, studentId]);

  if (!node) return null;

  return (
    <AnimatePresence>
      {node && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-950 shadow-2xl h-full flex flex-col border-l border-slate-200 dark:border-slate-800"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-md shadow-primary-500/15">
                  <FileQuestion className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {node.topic_name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Lịch sử trả lời sai hoặc bỏ trống
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/30">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mb-4" />
                  <p className="text-sm font-medium">Đang tải chi tiết...</p>
                </div>
              ) : data ? (
                <div className="space-y-4">
                  {data.answer_locked && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/50 flex gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                          Nội dung bị khóa
                        </h4>
                        <p className="text-sm text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                          {data.unlock_hint ||
                            "Bạn chưa được cấp quyền xem đáp án đúng và lời giải chi tiết."}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100"
                        >
                          Liên hệ quản trị
                        </Button>
                      </div>
                    </div>
                  )}

                  {data.questions?.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <FileQuestion className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-500 font-medium">
                        Không tìm thấy câu hỏi sai/trống nào.
                      </p>
                    </div>
                  ) : (
                    data.questions?.map((q: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex justify-between items-center">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <ArrowRight className="w-4 h-4 text-primary-500" />
                            {q.exam_label} • Câu {q.question_number}
                          </span>
                          <span
                            className={`text-[11px] uppercase font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                              q.is_correct
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                            }`}
                          >
                            {q.is_correct ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : q.student_answer ? (
                              <XCircle className="w-3.5 h-3.5" />
                            ) : null}
                            {q.is_correct ? "Đúng" : q.student_answer ? "Sai" : "Bỏ trống"}
                          </span>
                        </div>

                        <div className="p-5">
                          <div
                            className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 mb-4"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(q.content_markdown || ""),
                            }}
                          />

                          <div className="flex flex-wrap gap-3 items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                Bạn chọn:
                              </span>
                              <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm border border-slate-200 dark:border-slate-700">
                                {q.student_answer || "—"}
                              </span>
                            </div>

                            {!data.answer_locked && q.correct_answer && (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                  Đáp án đúng:
                                </span>
                                <span className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold text-sm border border-emerald-200 dark:border-emerald-800">
                                  {q.correct_answer}
                                </span>
                              </div>
                            )}
                          </div>

                          {!data.answer_locked && q.explanation_markdown && (
                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Lời giải chi tiết
                              </h5>
                              <div
                                className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 text-sm"
                                dangerouslySetInnerHTML={{
                                  __html: DOMPurify.sanitize(q.explanation_markdown),
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
