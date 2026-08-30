import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createQuestion,
  getQuestion,
  updateQuestion,
  checkDuplicate
} from "../../api/questions";
import type { QuestionCreate, QuestionSimilarityResponse } from "../../types";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import MarkdownEditor from "../../components/editor/MarkdownEditor";
import KnowledgeNodeSelector from "../../components/admin/question/KnowledgeNodeSelector";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { AlertCircle } from "lucide-react";

export default function QuestionFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(Boolean(id));
  const isEditMode = Boolean(id);

  const [content, setContent] = useState("");
  const [level, setLevel] = useState(1);
  const [type, setType] = useState("SINGLE_CHOICE");
  const [nodeId, setNodeId] = useState("");
  const [sourceAuthor, setSourceAuthor] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  
  // SINGLE_CHOICE state
  const [answers, setAnswers] = useState([
    { content: "", is_correct: true, position: 1 },
    { content: "", is_correct: false, position: 2 },
    { content: "", is_correct: false, position: 3 },
    { content: "", is_correct: false, position: 4 },
  ]);
  
  // FILL_IN_BLANK state
  const [fibAnswer, setFibAnswer] = useState("");

  const [duplicates, setDuplicates] = useState<QuestionSimilarityResponse[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  useEffect(() => {
    if (!id) return;
    const questionId = Number(id);
    if (Number.isNaN(questionId)) {
      navigate("/admin/questions");
      return;
    }

    getQuestion(questionId)
      .then((question) => {
        setContent(question.content);
        setLevel(question.level);
        setType(question.type || "SINGLE_CHOICE");
        setNodeId(String(question.knowledge_node_id));
        setSourceAuthor(question.source_author || "");
        setSourceTitle(question.source_title || "");
        
        if (question.type === "FILL_IN_BLANK") {
          setFibAnswer(question.answers[0]?.content || "");
        } else {
          setAnswers(
            question.answers.length > 0
              ? question.answers.slice().sort((a, b) => a.position - b.position)
              : [
                  { content: "Đúng", is_correct: true, position: 1 },
                  { content: "Sai", is_correct: false, position: 2 }
                ]
          );
        }
      })
      .catch((error) => {
        console.error(error);
        alert("Không tìm thấy câu hỏi để chỉnh sửa");
        navigate("/admin/questions");
      })
      .finally(() => setIsFetching(false));
  }, [id, navigate]);

  const handleTypeChange = (newType: string) => {
    if (content || answers.some(a => a.content) || fibAnswer) {
      const ok = window.confirm("Thay đổi dạng câu hỏi có thể làm mất dữ liệu bạn đang nhập. Chắc chắn tiếp tục?");
      if (!ok) return;
    }
    setType(newType);
    if (newType === "TRUE_FALSE") {
      setAnswers([
        { content: "Đúng", is_correct: true, position: 1 },
        { content: "Sai", is_correct: false, position: 2 }
      ]);
    } else if (newType === "SINGLE_CHOICE") {
      setAnswers([
        { content: "", is_correct: true, position: 1 },
        { content: "", is_correct: false, position: 2 },
        { content: "", is_correct: false, position: 3 },
        { content: "", is_correct: false, position: 4 },
      ]);
    } else if (newType === "COMPOSITE") {
       alert("Dạng câu hỏi chùm (COMPOSITE) sẽ được thiết kế ở phiên bản sau.");
       setType("SINGLE_CHOICE");
    }
  };

  const getNormalizedAnswers = () => {
    if (type === "FILL_IN_BLANK") {
      return [{ content: fibAnswer.trim(), is_correct: true, position: 1 }];
    } else if (type === "TRUE_FALSE") {
      return answers.map((a, idx) => ({ ...a, position: idx + 1 }));
    } else {
      return answers
        .map((a, idx) => ({ ...a, content: a.content.trim(), position: idx + 1 }))
        .filter(a => a.content.length > 0);
    }
  };

  const validateForm = () => {
    if (!nodeId) return "Vui lòng chọn Kỹ năng (Skill)";
    if (!content.trim()) return "Nội dung câu hỏi không được để trống";
    
    if (type === "SINGLE_CHOICE") {
      const normalizedAnswers = getNormalizedAnswers();
      if (normalizedAnswers.length !== 4) return "Cần nhập đầy đủ 4 đáp án";
      if (!normalizedAnswers.some(a => a.is_correct)) return "Vui lòng chọn một đáp án đúng";
    } else if (type === "FILL_IN_BLANK") {
      if (!fibAnswer.trim()) return "Vui lòng nhập đáp án điền khuyết";
    }
    
    return null;
  };

  const submitQuestion = async () => {
    setIsLoading(true);
    try {
      const data: QuestionCreate = {
        content,
        level,
        type,
        knowledge_node_id: parseInt(nodeId),
        source_author: sourceAuthor || undefined,
        source_title: sourceTitle || undefined,
        answers: getNormalizedAnswers(),
      };

      if (isEditMode && id) {
        await updateQuestion(Number(id), data);
      } else {
        await createQuestion(data);
      }
      navigate("/admin/questions");
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.detail || "Có lỗi xảy ra khi lưu câu hỏi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    if (!isEditMode) {
      setIsLoading(true);
      try {
        const dups = await checkDuplicate(content, parseInt(nodeId));
        if (dups.length > 0) {
          setDuplicates(dups);
          setShowDuplicateDialog(true);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error("Duplicate check failed", err);
      }
      setIsLoading(false);
    }

    submitQuestion();
  };

  const updateAnswer = (index: number, val: string) => {
    const newAnswers = [...answers];
    newAnswers[index].content = val;
    setAnswers(newAnswers);
  };

  const setCorrectAnswer = (index: number) => {
    const newAnswers = answers.map((a, i) => ({
      ...a,
      is_correct: i === index,
    }));
    setAnswers(newAnswers);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-gradient pb-1">
          {isEditMode ? "Chỉnh sửa câu hỏi" : "Thêm câu hỏi mới"}
        </h1>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Quay lại
        </Button>
      </div>

      {isFetching ? (
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-8 text-center text-sm text-slate-500 backdrop-blur-xl">
          Đang tải dữ liệu câu hỏi...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-card space-y-8">
          
          <div className="space-y-2">
            <KnowledgeNodeSelector value={nodeId} onChange={setNodeId} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                Mức độ
              </label>
              <select
                className="w-full px-4 py-2.5 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 rounded-xl shadow-[0_4px_12px_rgb(0,0,0,0.05)] focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all outline-none backdrop-blur-md"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
              >
                <option value={1}>Nhận biết</option>
                <option value={2}>Thông hiểu</option>
                <option value={3}>Vận dụng</option>
                <option value={4}>Vận dụng cao</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                Dạng câu hỏi
              </label>
              <select
                className="w-full px-4 py-2.5 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 rounded-xl shadow-[0_4px_12px_rgb(0,0,0,0.05)] focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all outline-none backdrop-blur-md"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value)}
              >
                <option value="SINGLE_CHOICE">Trắc nghiệm một lựa chọn</option>
                <option value="TRUE_FALSE">Đúng / Sai</option>
                <option value="FILL_IN_BLANK">Điền khuyết</option>
                <option value="COMPOSITE">Câu hỏi chùm (Sắp ra mắt)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              Nội dung câu hỏi
            </label>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder="Nhập nội dung câu hỏi..."
            />
          </div>

          <div className="space-y-5">
            <h3 className="font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3">
              Đáp án
            </h3>
            
            {type === "SINGLE_CHOICE" && answers.map((ans, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className="pt-3">
                  <input
                    type="radio"
                    name="correct_answer"
                    checked={ans.is_correct}
                    onChange={() => setCorrectAnswer(idx)}
                    className="w-5 h-5 text-primary-500 focus:ring-primary-500 border-slate-300 rounded-full cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label=""
                    placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`}
                    value={ans.content}
                    onChange={(e) => updateAnswer(idx, e.target.value)}
                    required
                  />
                </div>
              </div>
            ))}

            {type === "TRUE_FALSE" && answers.map((ans, idx) => (
              <div key={idx} className="flex items-center gap-4">
                 <input
                    type="radio"
                    name="correct_answer"
                    checked={ans.is_correct}
                    onChange={() => setCorrectAnswer(idx)}
                    className="w-5 h-5 text-primary-500 focus:ring-primary-500 border-slate-300 rounded-full cursor-pointer"
                  />
                  <span className="font-medium">{ans.content}</span>
              </div>
            ))}

            {type === "FILL_IN_BLANK" && (
               <Input
                 label=""
                 placeholder="Nhập đáp án đúng..."
                 value={fibAnswer}
                 onChange={(e) => setFibAnswer(e.target.value)}
                 required
               />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                Nguồn (Tác giả)
              </label>
              <Input
                label=""
                placeholder="VD: Bộ GD&ĐT"
                value={sourceAuthor}
                onChange={(e) => setSourceAuthor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                Nguồn (Đề thi/Tài liệu)
              </label>
              <Input
                label=""
                placeholder="VD: Đề minh họa ĐGNL 2024"
                value={sourceTitle}
                onChange={(e) => setSourceTitle(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-slate-200 dark:border-white/10">
            <Button type="submit" isLoading={isLoading} size="lg" className="shadow-lg shadow-primary-500/20">
              {isEditMode ? "Cập nhật câu hỏi" : "Lưu câu hỏi"}
            </Button>
          </div>
        </form>
      )}

      {/* Duplicate Alert Dialog */}
      <ConfirmDialog
        isOpen={showDuplicateDialog}
        title="Cảnh báo trùng lặp nội dung!"
        message={
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-4 h-4" /> Hệ thống phát hiện có các câu hỏi tương tự trong cùng chuyên đề. Bạn có chắc chắn muốn lưu thành câu mới?
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 p-2 rounded">
              {duplicates.map(d => (
                <div key={d.question_id} className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold">ID: #{d.question_id}</span>
                    <span className="text-red-500 font-medium">Giống {(d.similarity_score * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{d.content}</p>
                </div>
              ))}
            </div>
          </div>
        }
        confirmText="Vẫn lưu (Tạo mới)"
        cancelText="Hủy bỏ, tôi sẽ sửa lại"
        onConfirm={() => {
          setShowDuplicateDialog(false);
          submitQuestion();
        }}
        onCancel={() => setShowDuplicateDialog(false)}
      />
    </div>
  );
}
