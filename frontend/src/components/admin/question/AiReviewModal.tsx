import { useState, useEffect } from "react";
import { AiAnalysisResponse, AiReviewStatus, AiAnalysisResult } from "../../../types";
import { analyzeQuestion, reviewAiAnalysis } from "../../../api/questions";
import { Button } from "../../ui/Button";
import Input from "../../ui/Input";
import { toast } from "../../ui/Toast";
import { Sparkles, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface AiReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionId: number | null;
}

export default function AiReviewModal({ isOpen, onClose, questionId }: AiReviewModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState<AiAnalysisResponse | null>(null);
  
  // Editable fields
  const [concepts, setConcepts] = useState<string>("");
  const [skills, setSkills] = useState<string>("");
  const [cognitiveLevel, setCognitiveLevel] = useState<number>(1);
  const [explanation, setExplanation] = useState<string>("");

  useEffect(() => {
    if (isOpen && questionId) {
      fetchAnalysis();
    }
  }, [isOpen, questionId]);

  const fetchAnalysis = async () => {
    if (!questionId) return;
    setIsLoading(true);
    try {
      const data = await analyzeQuestion(questionId);
      setAnalysis(data);
      if (data.analysis_result) {
        setConcepts(data.analysis_result.concepts.join(", "));
        setSkills(data.analysis_result.skills.join(", "));
        setCognitiveLevel(data.analysis_result.cognitive_level);
        setExplanation(data.analysis_result.explanation || "");
      }
    } catch (error) {
      console.error(error);
      toast.error("Không thể phân tích hoặc tải kết quả AI.");
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (status: AiReviewStatus) => {
    if (!analysis || !questionId) return;
    setIsSubmitting(true);
    try {
      const updatedResult: AiAnalysisResult = {
        concepts: concepts.split(",").map((s) => s.trim()).filter(Boolean),
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        cognitive_level: cognitiveLevel,
        explanation: explanation,
      };
      
      await reviewAiAnalysis(questionId, {
        review_status: status,
        updated_analysis_result: status === AiReviewStatus.HUMAN_EDITED ? updatedResult : undefined,
      });
      toast.success("Đã lưu kết quả duyệt!");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi lưu kết quả duyệt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-5 h-5" /> Trợ lý Phân tích AI
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
              <p>AI đang phân tích câu hỏi (có thể mất vài giây)...</p>
            </div>
          ) : analysis ? (
            <div className="space-y-4 text-left">
              {analysis.review_status !== AiReviewStatus.PENDING && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-md flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Trạng thái: Đã duyệt ({analysis.review_status})</span>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-semibold">Concepts (Khái niệm)</label>
                <Input
                  label=""
                  value={concepts}
                  onChange={(e) => setConcepts(e.target.value)}
                  placeholder="Cách nhau bằng dấu phẩy..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Skills (Kỹ năng)</label>
                <Input
                  label=""
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="Cách nhau bằng dấu phẩy..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Mức độ nhận thức (1-4)</label>
                <input
                  type="number"
                  min={1} max={4}
                  value={cognitiveLevel}
                  onChange={(e) => setCognitiveLevel(Number(e.target.value))}
                  className="w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold">Giải thích của AI</label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">Không có dữ liệu phân tích.</div>
          )}
        </div>

        {!isLoading && analysis && (
          <div className="p-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
            <Button
              variant="outline"
              onClick={() => handleSubmit(AiReviewStatus.HUMAN_REJECTED)}
              disabled={isSubmitting}
            >
              Từ chối
            </Button>
            <Button
              variant="outline"
              className="text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
              onClick={() => handleSubmit(AiReviewStatus.HUMAN_EDITED)}
              disabled={isSubmitting}
            >
              Lưu chỉnh sửa
            </Button>
            <Button
              variant="default"
              onClick={() => handleSubmit(AiReviewStatus.HUMAN_CONFIRMED)}
              disabled={isSubmitting}
            >
              Xác nhận (Giữ nguyên)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
