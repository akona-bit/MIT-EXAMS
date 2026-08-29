import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createQuestion,
  getQuestion,
  updateQuestion,
} from "../../api/questions";
import { getKnowledgeTree } from "../../api/knowledge";
import type { KnowledgeNode, QuestionCreate } from "../../types";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

export default function QuestionFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(Boolean(id));
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const isEditMode = Boolean(id);

  const [content, setContent] = useState("");
  const [level, setLevel] = useState(1);
  const [nodeId, setNodeId] = useState("");
  const [answers, setAnswers] = useState([
    { content: "", is_correct: true, position: 1 },
    { content: "", is_correct: false, position: 2 },
    { content: "", is_correct: false, position: 3 },
    { content: "", is_correct: false, position: 4 },
  ]);

  useEffect(() => {
    getKnowledgeTree().then(setNodes).catch(console.error);

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
        setNodeId(String(question.knowledge_node_id));
        setAnswers(
          question.answers.length > 0
            ? question.answers
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((answer, index) => ({
                  ...answer,
                  position: answer.position || index + 1,
                }))
            : [
                { content: "", is_correct: true, position: 1 },
                { content: "", is_correct: false, position: 2 },
                { content: "", is_correct: false, position: 3 },
                { content: "", is_correct: false, position: 4 },
              ],
        );
      })
      .catch((error) => {
        console.error(error);
        alert("Không tìm thấy câu hỏi để chỉnh sửa");
        navigate("/admin/questions");
      })
      .finally(() => setIsFetching(false));
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      alert("Nội dung câu hỏi không được để trống");
      return;
    }

    if (!nodeId) {
      alert("Vui lòng chọn chủ đề kiến thức");
      return;
    }

    const normalizedAnswers = answers
      .map((answer, index) => ({
        ...answer,
        content: answer.content.trim(),
        position: answer.position || index + 1,
      }))
      .filter((answer) => answer.content.length > 0);

    if (normalizedAnswers.length < 2) {
      alert("Cần ít nhất 2 đáp án có nội dung");
      return;
    }

    if (!normalizedAnswers.some((answer) => answer.is_correct)) {
      alert("Vui lòng chọn một đáp án đúng");
      return;
    }

    setIsLoading(true);
    try {
      const data: QuestionCreate = {
        content,
        level,
        type: "SINGLE_CHOICE",
        knowledge_node_id: parseInt(nodeId),
        answers: normalizedAnswers.map((answer, index) => ({
          ...answer,
          position: answer.position || index + 1,
        })),
      };

      if (isEditMode && id) {
        await updateQuestion(Number(id), data);
      } else {
        await createQuestion(data);
      }

      navigate("/admin/questions");
    } catch (error) {
      console.error(error);
      alert(
        isEditMode
          ? "Có lỗi xảy ra khi cập nhật câu hỏi"
          : "Có lỗi xảy ra khi tạo câu hỏi",
      );
    } finally {
      setIsLoading(false);
    }
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

  const renderNodeOptions = (ns: KnowledgeNode[], depth = 0) => {
    let options: React.ReactNode[] = [];
    for (const node of ns) {
      const prefix = "—".repeat(depth) + (depth > 0 ? " " : "");
      options.push(
        <option key={node.id} value={node.id}>
          {prefix}
          {node.name}
        </option>,
      );
      if (node.children && node.children.length > 0) {
        options = options.concat(renderNodeOptions(node.children, depth + 1));
      }
    }
    return options;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
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
        <form
          onSubmit={handleSubmit}
          className="bg-white/70 dark:bg-slate-900/70 p-6 sm:p-8 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] backdrop-blur-xl space-y-8"
        >
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              Nội dung câu hỏi
            </label>
            <textarea
              required
              rows={4}
              className="w-full px-4 py-3 text-sm bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung câu hỏi..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                Mức độ
              </label>
              <select
                className="w-full px-4 py-3 text-sm bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
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
                Kiến thức
              </label>
              <select
                required
                className="w-full px-4 py-3 text-sm bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
              >
                <option value="">-- Chọn chủ đề kiến thức --</option>
                {renderNodeOptions(nodes)}
              </select>
            </div>
          </div>

          <div className="space-y-5">
            <h3 className="font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3">
              Đáp án
            </h3>
            {answers.map((ans, idx) => (
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
          </div>

          <div className="flex justify-end pt-6 border-t border-slate-200 dark:border-white/10">
            <Button type="submit" isLoading={isLoading} size="lg" className="shadow-lg shadow-primary-500/20">
              {isEditMode ? "Cập nhật câu hỏi" : "Lưu câu hỏi"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
