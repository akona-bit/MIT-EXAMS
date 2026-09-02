interface QuestionNavStripProps {
  questions: any[];
  savedAnswers: any;
  flaggedQuestions: Set<number>;
  currentIndex: number;
  onSelect: (index: number) => void;
}

export default function QuestionNavStrip({
  questions,
  savedAnswers,
  flaggedQuestions,
  currentIndex,
  onSelect,
}: QuestionNavStripProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
      {questions.map((q, idx) => {
        const isSelected = currentIndex === idx;
        const isFlagged = flaggedQuestions.has(q.exam_form_question_id);
        const hasAnswer = !!savedAnswers[q.exam_form_question_id];

        let bgClass = "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200";
        if (isSelected) {
          bgClass = "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/30 scale-110";
        } else if (isFlagged) {
          bgClass = "bg-amber-100 text-amber-800 border-amber-400 ring-1 ring-amber-400";
        } else if (hasAnswer) {
          bgClass = "bg-green-100 text-green-800 border-green-400";
        }

        return (
          <button
            key={q.exam_form_question_id}
            onClick={() => onSelect(idx)}
            className={`
              relative flex items-center justify-center shrink-0
              w-9 h-9 rounded-full border text-xs font-bold
              transition-all duration-150 cursor-pointer
              ${bgClass}
            `}
            title={`Phần ${q.part} — Câu ${q.position}${isFlagged ? " (Đã đánh dấu)" : ""}${hasAnswer ? " (Đã trả lời)" : ""}`}
          >
            {q.position}
            {isFlagged && !isSelected && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white" />
            )}
          </button>
        );
      })}
    </div>
  );
}
