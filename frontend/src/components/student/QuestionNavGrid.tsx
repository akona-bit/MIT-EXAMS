import React from "react";

interface QuestionNavGridProps {
  questions: any[];
  savedAnswers: any;
  flaggedQuestions: Set<number>;
  currentIndex: number;
  onSelect: (index: number) => void;
}

export default function QuestionNavGrid({
  questions,
  savedAnswers,
  flaggedQuestions,
  currentIndex,
  onSelect
}: QuestionNavGridProps) {
  // Lưới động dựa trên chiều dài mảng questions thực tế
  return (
    <div className="grid grid-cols-5 gap-2">
      {questions.map((q, idx) => {
        const isSelected = currentIndex === idx;
        const isFlagged = flaggedQuestions.has(q.exam_form_question_id);
        const hasAnswer = !!savedAnswers[q.exam_form_question_id];
        
        let bgColor = "bg-gray-100 hover:bg-gray-200 text-gray-700";
        if (isFlagged) {
          bgColor = "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300";
        } else if (hasAnswer) {
          bgColor = "bg-primary-100 hover:bg-primary-200 text-primary-800 border-primary-300";
        }
        
        const borderClass = isSelected ? "ring-2 ring-primary-500 ring-offset-1 border-transparent" : "border-gray-200";

        return (
          <button
            key={q.exam_form_question_id}
            onClick={() => onSelect(idx)}
            className={`
              flex items-center justify-center h-10 rounded text-sm font-medium border
              transition-all ${bgColor} ${borderClass}
            `}
            title={`Phần ${q.part} - Câu ${q.position}`}
          >
            {q.position}
            {isFlagged && <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full transform translate-x-1/3 -translate-y-1/3" />}
          </button>
        );
      })}
    </div>
  );
}
