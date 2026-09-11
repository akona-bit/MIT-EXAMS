interface QuestionNavStripProps {
  questions: any[];
  savedAnswers: any;
  flaggedQuestions: Set<number>;
  currentIndex: number;
  onSelect: (index: number) => void;
  showMissingWarning?: boolean;
}

export default function QuestionNavStrip({
  questions,
  savedAnswers,
  flaggedQuestions,
  currentIndex,
  onSelect,
  showMissingWarning = false,
}: QuestionNavStripProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
      {questions.map((q, idx) => {
        const isSelected = currentIndex === idx;
        const isFlagged = flaggedQuestions.has(q.exam_form_question_id);
        const hasAnswer = !!savedAnswers[q.exam_form_question_id];

        let bgClass = "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
        if (isSelected) {
          bgClass = "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/30 scale-110 z-10";
        } else if (isFlagged) {
          bgClass = "bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-300";
        } else if (hasAnswer) {
          bgClass = "bg-yellow-400 text-yellow-900 border-yellow-500";
        } else if (showMissingWarning) {
          bgClass = "bg-red-50 text-red-700 border-red-500 animate-pulse";
        }

        return (
          <button
            key={q.exam_form_question_id}
            onClick={() => onSelect(idx)}
            className={`
              relative flex items-center justify-center shrink-0
              w-10 h-10 rounded-xl border text-sm font-bold
              transition-all duration-200 cursor-pointer
              ${bgClass}
            `}
            title={`Phần ${q.part} — Câu ${q.position}${isFlagged ? " (Đã đánh dấu)" : ""}${hasAnswer ? " (Đã trả lời)" : ""}`}
          >
            {q.position}
            {isFlagged && !isSelected && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white shadow-sm" />
            )}
          </button>
        );
      })}
    </div>
  );
}
