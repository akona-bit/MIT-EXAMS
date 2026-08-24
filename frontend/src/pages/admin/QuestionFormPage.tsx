import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createQuestion } from '../../api/questions';
import { getKnowledgeTree } from '../../api/knowledge';
import type { KnowledgeNode, QuestionCreate } from '../../types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function QuestionFormPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  
  const [content, setContent] = useState('');
  const [level, setLevel] = useState(1);
  const [nodeId, setNodeId] = useState('');
  const [answers, setAnswers] = useState([
    { content: '', is_correct: true, position: 1 },
    { content: '', is_correct: false, position: 2 },
    { content: '', is_correct: false, position: 3 },
    { content: '', is_correct: false, position: 4 },
  ]);

  useEffect(() => {
    getKnowledgeTree().then(setNodes).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data: QuestionCreate = {
        content,
        level,
        type: 'SINGLE_CHOICE',
        knowledge_node_id: parseInt(nodeId),
        answers
      };
      await createQuestion(data);
      navigate('/admin/questions');
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra khi tạo câu hỏi');
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
    const newAnswers = answers.map((a, i) => ({ ...a, is_correct: i === index }));
    setAnswers(newAnswers);
  };

  const renderNodeOptions = (ns: KnowledgeNode[], depth = 0) => {
    let options: React.ReactNode[] = [];
    for (const node of ns) {
      const prefix = '—'.repeat(depth) + (depth > 0 ? ' ' : '');
      options.push(<option key={node.id} value={node.id}>{prefix}{node.name}</option>);
      if (node.children && node.children.length > 0) {
        options = options.concat(renderNodeOptions(node.children, depth + 1));
      }
    }
    return options;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Thêm câu hỏi mới</h1>
        <Button variant="ghost" onClick={() => navigate(-1)}>Quay lại</Button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Nội dung câu hỏi</label>
          <textarea
            required
            rows={4}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Nhập nội dung câu hỏi..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Mức độ</label>
            <select
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg"
              value={level}
              onChange={e => setLevel(Number(e.target.value))}
            >
              <option value={1}>Nhận biết</option>
              <option value={2}>Thông hiểu</option>
              <option value={3}>Vận dụng</option>
              <option value={4}>Vận dụng cao</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Kiến thức</label>
            <select
              required
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg"
              value={nodeId}
              onChange={e => setNodeId(e.target.value)}
            >
              <option value="">-- Chọn chủ đề kiến thức --</option>
              {renderNodeOptions(nodes)}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-neutral-900 border-b pb-2">Đáp án</h3>
          {answers.map((ans, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className="pt-2">
                <input
                  type="radio"
                  name="correct_answer"
                  checked={ans.is_correct}
                  onChange={() => setCorrectAnswer(idx)}
                  className="w-4 h-4 text-primary-500"
                />
              </div>
              <div className="flex-1">
                <Input
                  label=""
                  placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`}
                  value={ans.content}
                  onChange={e => updateAnswer(idx, e.target.value)}
                  required
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t border-neutral-100">
          <Button type="submit" isLoading={isLoading}>Lưu câu hỏi</Button>
        </div>
      </form>
    </div>
  );
}
