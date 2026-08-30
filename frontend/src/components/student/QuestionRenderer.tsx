import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface QuestionRendererProps {
  question: any;
  answer: any;
  onChange: (payload: any) => void;
}

export default function QuestionRenderer({ question, answer, onChange }: QuestionRendererProps) {
  const type = question.type;

  if (type === "SINGLE_CHOICE") {
    return (
      <div className="space-y-4">
        <div className="prose max-w-none text-gray-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {question.content}
          </ReactMarkdown>
        </div>
        <div className="space-y-3 mt-6">
          {question.options.map((opt: any, i: number) => {
            const isChecked = answer?.selected_answer_id === opt.id;
            return (
              <label 
                key={opt.id} 
                className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors
                  ${isChecked ? 'bg-primary-50 border-primary-300' : 'bg-white hover:bg-gray-50 border-gray-200'}`}
              >
                <input 
                  type="radio" 
                  name={`q-${question.question_id}`}
                  value={opt.id}
                  checked={isChecked}
                  onChange={() => onChange({ selected_answer_id: opt.id })}
                  className="mt-1 w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <div className="flex-1 prose prose-sm max-w-none">
                  <span className="font-bold mr-2 text-gray-500">{String.fromCharCode(65 + i)}.</span>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {opt.content}
                  </ReactMarkdown>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    );
  }
  
  if (type === "MULTIPLE_CHOICE") {
    // Tạm thời render giống SINGLE_CHOICE nhưng cho checkbox (không có logic chấm điểm theo yêu cầu)
    const selectedIds = answer?.selected_answer_ids || [];
    
    return (
      <div className="space-y-4">
        <div className="prose max-w-none text-gray-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {question.content}
          </ReactMarkdown>
        </div>
        <div className="space-y-3 mt-6">
          {question.options.map((opt: any, i: number) => {
            const isChecked = selectedIds.includes(opt.id);
            return (
              <label 
                key={opt.id} 
                className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors
                  ${isChecked ? 'bg-primary-50 border-primary-300' : 'bg-white hover:bg-gray-50 border-gray-200'}`}
              >
                <input 
                  type="checkbox" 
                  name={`q-${question.question_id}-${opt.id}`}
                  value={opt.id}
                  checked={isChecked}
                  onChange={(e) => {
                    const newIds = e.target.checked 
                      ? [...selectedIds, opt.id] 
                      : selectedIds.filter((id: number) => id !== opt.id);
                    onChange({ selected_answer_ids: newIds });
                  }}
                  className="mt-1 w-5 h-5 text-primary-600 rounded focus:ring-primary-500 border-gray-300"
                />
                <div className="flex-1 prose prose-sm max-w-none">
                  <span className="font-bold mr-2 text-gray-500">{String.fromCharCode(65 + i)}.</span>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {opt.content}
                  </ReactMarkdown>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    );
  }
  
  // NOTE: TRUE_FALSE, FILL_IN_BLANK, COMPOSITE can be implemented fully later.
  // For now we just implement the basic single choice and multiple choice as requested by the plan.
  
  return (
    <div className="p-4 bg-yellow-50 text-yellow-800 rounded">
      Chưa hỗ trợ hiển thị loại câu hỏi: {type}
    </div>
  );
}
