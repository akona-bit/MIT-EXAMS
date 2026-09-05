import MarkdownEditor from '../../editor/MarkdownEditor';
import { QuestionBulkUpdateItem } from '../../../api/passages';
import KnowledgeNodeSelector from '../question/KnowledgeNodeSelector';
import { toast } from '../../ui/Toast';

interface QuestionBlockProps {
  question: QuestionBulkUpdateItem;
  index: number;
  onChange: (index: number, updated: QuestionBulkUpdateItem) => void;
  onRemove: (index: number) => void;
}

export default function QuestionBlock({ question, index, onChange, onRemove }: QuestionBlockProps) {
  
  const handleContentChange = (content: string) => {
    onChange(index, { ...question, content });
  };
  
  const handleAnswerChange = (aIdx: number, field: string, value: any) => {
    const newAnswers = [...question.answers];
    if (field === 'is_correct' && value === true) {
      newAnswers.forEach(a => a.is_correct = false);
    }
    newAnswers[aIdx] = { ...newAnswers[aIdx], [field]: value };
    onChange(index, { ...question, answers: newAnswers });
  };

  const handleTypeChange = (newType: string) => {
    let newAnswers = [...question.answers];
    if (newType === "TRUE_FALSE") {
      newAnswers = [];
      const newSubItems = [
        { label: "a", prompt: "", position: 1, point_weight: 0.25, kind: "tf", answers: [{ content: "Đúng", is_correct: true, position: 1 }, { content: "Sai", is_correct: false, position: 2 }] },
        { label: "b", prompt: "", position: 2, point_weight: 0.25, kind: "tf", answers: [{ content: "Đúng", is_correct: true, position: 1 }, { content: "Sai", is_correct: false, position: 2 }] },
        { label: "c", prompt: "", position: 3, point_weight: 0.25, kind: "tf", answers: [{ content: "Đúng", is_correct: true, position: 1 }, { content: "Sai", is_correct: false, position: 2 }] },
        { label: "d", prompt: "", position: 4, point_weight: 0.25, kind: "tf", answers: [{ content: "Đúng", is_correct: true, position: 1 }, { content: "Sai", is_correct: false, position: 2 }] }
      ];
      onChange(index, { ...question, type: newType, answers: newAnswers, sub_items: newSubItems });
      return;
    } else if (newType === "SINGLE_CHOICE") {
      newAnswers = [
        { content: "", is_correct: true, position: 1 },
        { content: "", is_correct: false, position: 2 },
        { content: "", is_correct: false, position: 3 },
        { content: "", is_correct: false, position: 4 }
      ];
    } else if (newType === "FILL_IN_BLANK") {
      newAnswers = [{ content: "", is_correct: true, position: 1 }];
    } else if (newType === "COMPOSITE") {
      toast.info("Dạng câu hỏi chùm (COMPOSITE) đang phát triển.");
      return;
    }
    onChange(index, { ...question, type: newType, answers: newAnswers, sub_items: undefined });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm mb-6 overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
        <h4 className="font-semibold text-slate-700">Câu hỏi {index + 1}</h4>
        <button 
          onClick={() => onRemove(index)}
          className="text-red-500 hover:text-red-700 text-sm font-medium"
        >
          Xóa câu này
        </button>
      </div>
      
      <div className="p-4 space-y-6">
        
        {/* Knowledge Node Selector */}
        <div className="space-y-2">
          <KnowledgeNodeSelector 
            primaryValue={question.primary_knowledge_node_id}
            onPrimaryChange={(val) => onChange(index, { ...question, primary_knowledge_node_id: val || 1 })}
            secondaryValues={question.secondary_knowledge_node_ids || []}
            onSecondaryChange={(val) => onChange(index, { ...question, secondary_knowledge_node_ids: val })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mức độ</label>
            <select 
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={question.level}
              onChange={(e) => onChange(index, { ...question, level: parseInt(e.target.value) })}
            >
              <option value={1}>Nhận biết</option>
              <option value={2}>Thông hiểu</option>
              <option value={3}>Vận dụng</option>
              <option value={4}>Vận dụng cao</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dạng câu hỏi</label>
            <select 
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={question.type || "SINGLE_CHOICE"}
              onChange={(e) => handleTypeChange(e.target.value)}
            >
              <option value="SINGLE_CHOICE">Trắc nghiệm một lựa chọn</option>
              <option value="TRUE_FALSE">Đúng / Sai</option>
              <option value="FILL_IN_BLANK">Điền khuyết</option>
              <option value="COMPOSITE">Câu hỏi chùm</option>
            </select>
          </div>
        </div>

        {/* Nội dung câu hỏi */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nội dung câu hỏi</label>
          <MarkdownEditor 
            value={question.content} 
            onChange={handleContentChange} 
            placeholder="Nhập nội dung câu hỏi con..."
          />
        </div>
        
        {/* Các đáp án */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Đáp án</label>
          <div className="space-y-3">
            
            {(!question.type || question.type === "SINGLE_CHOICE") && question.answers.map((ans, aIdx) => {
              const letter = String.fromCharCode(65 + aIdx); // A, B, C, D
              return (
                <div key={aIdx} className={`flex items-start gap-3 p-3 rounded-md border ${ans.is_correct ? 'border-green-300 bg-green-50' : 'border-slate-200'}`}>
                  <div className="pt-1">
                    <input 
                      type="radio" 
                      name={`correct_ans_${index}`} 
                      checked={ans.is_correct}
                      onChange={() => handleAnswerChange(aIdx, 'is_correct', true)}
                      className="w-4 h-4 text-blue-600 cursor-pointer"
                    />
                  </div>
                  <div className="font-bold pt-1 w-6">{letter}.</div>
                  <div className="flex-1">
                    <textarea 
                      className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500"
                      rows={2}
                      value={ans.content}
                      onChange={(e) => handleAnswerChange(aIdx, 'content', e.target.value)}
                      placeholder={`Nhập đáp án ${letter}...`}
                    />
                  </div>
                </div>
              );
            })}

            {question.type === "TRUE_FALSE" && (question.sub_items || []).map((sub, sIdx) => (
              <div key={sIdx} className="flex flex-col gap-2 p-3 border border-slate-200 rounded-md">
                 <div className="flex items-center gap-2">
                    <span className="font-bold">{sub.label}.</span>
                    <input
                      type="text"
                      className="flex-1 border border-slate-300 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder={`Mệnh đề ${sub.label}...`}
                      value={sub.prompt || ""}
                      onChange={(e) => {
                        const newSub = [...(question.sub_items || [])];
                        newSub[sIdx] = { ...newSub[sIdx], prompt: e.target.value };
                        onChange(index, { ...question, sub_items: newSub });
                      }}
                    />
                 </div>
                 <div className="flex gap-4 ml-6">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" checked={sub.answers.find((a:any) => a.content==="Đúng")?.is_correct} onChange={() => {
                        const newSub = [...(question.sub_items || [])];
                        newSub[sIdx].answers = [{ content: "Đúng", is_correct: true, position: 1 }, { content: "Sai", is_correct: false, position: 2 }];
                        onChange(index, { ...question, sub_items: newSub });
                      }} className="text-green-500" />
                      <span className="text-sm font-medium text-green-700">Đúng</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" checked={sub.answers.find((a:any) => a.content==="Sai")?.is_correct} onChange={() => {
                        const newSub = [...(question.sub_items || [])];
                        newSub[sIdx].answers = [{ content: "Đúng", is_correct: false, position: 1 }, { content: "Sai", is_correct: true, position: 2 }];
                        onChange(index, { ...question, sub_items: newSub });
                      }} className="text-red-500" />
                      <span className="text-sm font-medium text-red-700">Sai</span>
                    </label>
                 </div>
              </div>
            ))}

            {question.type === "FILL_IN_BLANK" && (
               <input
                 type="text"
                 className="w-full border border-slate-300 rounded-md px-3 py-2"
                 placeholder="Nhập đáp án đúng..."
                 value={question.answers[0]?.content || ""}
                 onChange={(e) => handleAnswerChange(0, 'content', e.target.value)}
               />
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
