import { useState } from "react"
import { Grid3X3, X } from "lucide-react"
import { motion } from "framer-motion"

interface QuestionNavStripProps {
  questions: any[]
  savedAnswers: any
  flaggedQuestions: Set<number>
  currentIndex: number
  onSelect: (index: number) => void
  showMissingWarning?: boolean
}

export default function QuestionNavStrip({
  questions,
  savedAnswers,
  flaggedQuestions,
  currentIndex,
  onSelect,
  showMissingWarning = false,
}: QuestionNavStripProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const handleSelect = (index: number) => {
    onSelect(index)
    setIsDrawerOpen(false)
  }

  // Mobile: compact summary bar + grid drawer
  return (
    <>
      {/* Mobile compact bar */}
      <div className="md:hidden flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm active:scale-95 transition-transform"
        >
          <Grid3X3 className="w-4 h-4" />
          Câu {questions[currentIndex]?.position || currentIndex + 1}/{questions.length}
        </button>
        <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-thin">
          {questions.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map((q, idx) => {
            const actualIdx = Math.max(0, currentIndex - 2) + idx
            const isSelected = actualIdx === currentIndex
            const hasAnswer = !!savedAnswers[q.exam_form_question_id]
            const isFlagged = flaggedQuestions.has(q.exam_form_question_id)

            return (
              <button
                key={q.exam_form_question_id}
                onClick={() => handleSelect(actualIdx)}
                className={`
                  shrink-0 w-8 h-8 rounded-lg border text-xs font-bold transition-all
                  ${isSelected
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : hasAnswer
                      ? "bg-yellow-400 text-yellow-900 border-yellow-500"
                      : isFlagged
                        ? "bg-amber-50 text-amber-700 border-amber-300"
                        : "bg-white dark:bg-slate-900 text-slate-600 border-slate-200 dark:border-slate-700"
                  }
                `}
              >
                {q.position}
              </button>
            )
          })}
        </div>
      </div>

      {/* Desktop: horizontal strip */}
      <div className="hidden md:flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {questions.map((q, idx) => {
          const isSelected = currentIndex === idx
          const isFlagged = flaggedQuestions.has(q.exam_form_question_id)
          const hasAnswer = !!savedAnswers[q.exam_form_question_id]

          let bgClass = "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          if (isSelected) {
            bgClass = "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/30 scale-110 z-10"
          } else if (isFlagged) {
            bgClass = "bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-300"
          } else if (hasAnswer) {
            bgClass = "bg-yellow-400 text-yellow-900 border-yellow-500"
          } else if (showMissingWarning) {
            bgClass = "bg-red-50 text-red-700 border-red-500 animate-pulse"
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
          )
        })}
      </div>

      {/* Mobile Grid Drawer (fullscreen overlay) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(false)}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-950 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white">
                Chọn câu hỏi ({questions.length})
              </h3>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 py-2.5 text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-indigo-600" /> Đang xem
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-yellow-400" /> Đã trả lời
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Đánh dấu
              </span>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-8 gap-2">
                {questions.map((q, idx) => {
                  const isSelected = currentIndex === idx
                  const hasAnswer = !!savedAnswers[q.exam_form_question_id]
                  const isFlagged = flaggedQuestions.has(q.exam_form_question_id)

                  return (
                    <button
                      key={q.exam_form_question_id}
                      onClick={() => handleSelect(idx)}
                      className={`
                        relative flex items-center justify-center
                        h-12 rounded-xl border text-sm font-bold
                        transition-all active:scale-95 shadow-sm
                        ${isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/30"
                          : hasAnswer
                            ? "bg-yellow-400 text-yellow-900 border-yellow-500 shadow-sm"
                            : isFlagged
                              ? "bg-amber-50 text-amber-700 border-amber-300"
                              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }
                      `}
                    >
                      {q.position}
                      {isFlagged && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Drawer footer */}
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 text-center bg-slate-50 dark:bg-slate-900 rounded-b-3xl">
              <p className="text-xs font-semibold text-slate-500">
                Đã trả lời:{" "}
                <strong className="text-primary-600 dark:text-primary-400">
                  {Object.keys(savedAnswers).length}/{questions.length}
                </strong>
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}
