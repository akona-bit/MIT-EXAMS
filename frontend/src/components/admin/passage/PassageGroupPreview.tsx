import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface PassageGroupPreviewProps {
  passageContent: string;
  sourceAuthor?: string;
  sourceTitle?: string;
  questions: {
    content: string;
    answers: { content: string; is_correct: boolean }[];
  }[];
}

export default function PassageGroupPreview({
  passageContent,
  sourceAuthor,
  sourceTitle,
  questions,
}: PassageGroupPreviewProps) {
  // Logic to determine layout of answers: choiceFour (1 col), choiceTwo (2 cols), choiceOne (4 cols)
  // We'll use 2 columns (grid-cols-2) generally, or flex for very short answers

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
      <div className="prose prose-sm max-w-none text-slate-800">
        {/* Passage Content */}
        {passageContent && (
          <div className="mb-4 pb-4 border-b border-slate-200">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                img: ({ node, ...props }) => (
                  <img {...props} className="max-w-full rounded-md" />
                ),
              }}
            >
              {passageContent}
            </ReactMarkdown>

            {(sourceAuthor || sourceTitle) && (
              <div className="text-right text-xs text-slate-500 italic mt-2">
                Nguồn: {sourceAuthor} {sourceTitle ? `- ${sourceTitle}` : ""}
              </div>
            )}
          </div>
        )}

        {/* Questions */}
        <div className="space-y-6">
          {questions.map((q, idx) => (
            <div key={idx} className="question-block">
              <div className="font-semibold flex">
                <span className="mr-2">Câu {idx + 1}:</span>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {q.content || "..."}
                </ReactMarkdown>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 ml-6">
                {q.answers.map((ans, aIdx) => {
                  const letter = String.fromCharCode(65 + aIdx); // A, B, C, D
                  return (
                    <div key={aIdx} className="flex items-start">
                      <span
                        className={`font-bold mr-2 ${ans.is_correct ? "text-green-600" : ""}`}
                      >
                        {letter}.
                      </span>
                      <div className={ans.is_correct ? "text-green-700" : ""}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {ans.content || "..."}
                        </ReactMarkdown>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {questions.length === 0 && (
            <div className="text-center text-slate-400 italic py-4">
              Chưa có câu hỏi nào.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
