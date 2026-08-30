import React from 'react';
import QuestionBlock from './QuestionBlock';
import { PassageDraftState } from '../../../hooks/usePassageGroupDraft';
import { QuestionBulkUpdateItem } from '../../../api/passages';

interface QuestionListStepProps {
  draft: PassageDraftState;
  updateDraft: (updates: Partial<PassageDraftState>) => void;
}

export default function QuestionListStep({ draft, updateDraft }: QuestionListStepProps) {
  
  const handleAddQuestion = () => {
    const newQuestion: QuestionBulkUpdateItem = {
      content: '',
      level: 1,
      type: 'SINGLE_CHOICE',
      knowledge_node_id: 1, // Default, should let user select
      answers: [
        { content: '', is_correct: true, position: 0 },
        { content: '', is_correct: false, position: 1 },
        { content: '', is_correct: false, position: 2 },
        { content: '', is_correct: false, position: 3 },
      ]
    };
    updateDraft({ questions: [...draft.questions, newQuestion] });
  };
  
  const handleQuestionChange = (index: number, updated: QuestionBulkUpdateItem) => {
    const newQuestions = [...draft.questions];
    newQuestions[index] = updated;
    updateDraft({ questions: newQuestions });
  };
  
  const handleRemoveQuestion = (index: number) => {
    if (window.confirm('Bạn có chắc muốn xoá câu hỏi này? Nếu lưu, câu hỏi này sẽ bị xoá vĩnh viễn.')) {
      const newQuestions = draft.questions.filter((_, idx) => idx !== index);
      updateDraft({ questions: newQuestions });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-sm text-blue-700">
        <p>Thêm các câu hỏi con dựa trên ngữ liệu chung đã tạo.</p>
        <p>Mỗi câu hỏi phải có chính xác 4 đáp án và 1 đáp án đúng.</p>
      </div>

      <div className="space-y-6">
        {draft.questions.map((q, idx) => (
          <QuestionBlock 
            key={idx} // Ideal is unique id, but idx is ok if we don't reorder
            question={q} 
            index={idx}
            onChange={handleQuestionChange}
            onRemove={handleRemoveQuestion}
          />
        ))}
        
        {draft.questions.length === 0 && (
          <div className="text-center py-10 border-2 border-dashed border-slate-300 rounded-lg">
            <p className="text-slate-500 mb-4">Chưa có câu hỏi nào trong nhóm này.</p>
          </div>
        )}
      </div>

      <div className="pt-4">
        <button 
          onClick={handleAddQuestion}
          className="w-full py-3 border-2 border-dashed border-blue-400 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors flex justify-center items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Thêm câu hỏi mới
        </button>
      </div>
    </div>
  );
}
