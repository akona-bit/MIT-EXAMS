import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface QuestionRendererProps {
  question: any;
  answer: any;
  onChange: (payload: any) => void;
}

export default function QuestionRenderer({
  question,
  answer,
  onChange,
}: QuestionRendererProps) {
  const type = question.type;

  // ─── SINGLE CHOICE (A, B, C, D) ───
  if (type === "SINGLE_CHOICE") {
    return (
      <div className="space-y-4">
        <div className="prose prose-sm max-w-none text-slate-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {question.content}
          </ReactMarkdown>
        </div>
        <div className="space-y-2.5 mt-5">
          {question.options.map((opt: any, i: number) => {
            const isChecked = answer?.selected_answer_id === opt.id;
            const letter = String.fromCharCode(65 + i);
            return (
              <label
                key={opt.id}
                className={`flex items-start gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all duration-150 ${
                  isChecked
                    ? "bg-blue-50 border-blue-500 shadow-sm"
                    : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div
                  className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded-full border-2 shrink-0 text-xs font-bold transition-colors ${
                    isChecked
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-slate-300 text-slate-500"
                  }`}
                >
                  {letter}
                </div>
                <input
                  type="radio"
                  name={`q-${question.question_id}`}
                  value={opt.id}
                  checked={isChecked}
                  onChange={() => onChange({ selected_answer_id: opt.id })}
                  className="sr-only"
                />
                <div className="flex-1 prose prose-sm max-w-none text-slate-700 pt-0.5">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                  >
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

  // ─── MULTIPLE CHOICE (checkbox) ───
  if (type === "MULTIPLE_CHOICE") {
    const selectedIds = answer?.selected_answer_ids || [];
    return (
      <div className="space-y-4">
        <div className="prose prose-sm max-w-none text-slate-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {question.content}
          </ReactMarkdown>
        </div>
        <p className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-md inline-block">
          Chọn nhiều đáp án
        </p>
        <div className="space-y-2.5">
          {question.options.map((opt: any, i: number) => {
            const isChecked = selectedIds.includes(opt.id);
            const letter = String.fromCharCode(65 + i);
            return (
              <label
                key={opt.id}
                className={`flex items-start gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all duration-150 ${
                  isChecked
                    ? "bg-blue-50 border-blue-500 shadow-sm"
                    : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div
                  className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded shrink-0 text-xs font-bold border-2 transition-colors ${
                    isChecked
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-slate-300 text-slate-500"
                  }`}
                >
                  {isChecked ? "✓" : letter}
                </div>
                <input
                  type="checkbox"
                  name={`q-${question.question_id}-${opt.id}`}
                  value={opt.id}
                  checked={isChecked}
                  onChange={(e) => {
                    const newIds = e.target.checked
                      ? [...selectedIds, opt.id]
                      : selectedIds.filter((sid: number) => sid !== opt.id);
                    onChange({ selected_answer_ids: newIds });
                  }}
                  className="sr-only"
                />
                <div className="flex-1 prose prose-sm max-w-none text-slate-700 pt-0.5">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                  >
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

  // ─── TRUE / FALSE ───
  if (type === "TRUE_FALSE") {
    const selectedId = answer?.selected_answer_id;
    // Use first 2 options as True/False, or synthesize
    const trueOpt = question.options?.[0];
    const falseOpt = question.options?.[1];

    return (
      <div className="space-y-4">
        <div className="prose prose-sm max-w-none text-slate-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {question.content}
          </ReactMarkdown>
        </div>
        <div className="flex gap-4 mt-5">
          {trueOpt && (
            <button
              type="button"
              onClick={() => onChange({ selected_answer_id: trueOpt.id })}
              className={`flex-1 py-4 rounded-xl border-2 font-bold text-lg transition-all duration-150 ${
                selectedId === trueOpt.id
                  ? "bg-green-50 border-green-500 text-green-700 shadow-md shadow-green-500/20"
                  : "bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:bg-green-50/50"
              }`}
            >
              <span className="text-2xl mr-2">✓</span>
              {trueOpt.content || "ĐÚNG"}
            </button>
          )}
          {falseOpt && (
            <button
              type="button"
              onClick={() => onChange({ selected_answer_id: falseOpt.id })}
              className={`flex-1 py-4 rounded-xl border-2 font-bold text-lg transition-all duration-150 ${
                selectedId === falseOpt.id
                  ? "bg-red-50 border-red-500 text-red-700 shadow-md shadow-red-500/20"
                  : "bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50/50"
              }`}
            >
              <span className="text-2xl mr-2">✗</span>
              {falseOpt.content || "SAI"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── FILL IN THE BLANK ───
  if (type === "FILL_IN_BLANK") {
    return (
      <div className="space-y-4">
        <div className="prose prose-sm max-w-none text-slate-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {question.content}
          </ReactMarkdown>
        </div>
        <div className="mt-5">
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Nhập đáp án của bạn:
          </label>
          <input
            type="text"
            value={answer?.text_answer || ""}
            onChange={(e) => onChange({ text_answer: e.target.value })}
            placeholder="Nhập câu trả lời..."
            className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
    );
  }

  // ─── Fallback: unsupported type ───
  return (
    <div className="p-5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
      <p className="font-medium">
        Loại câu hỏi "{type}" chưa được hỗ trợ hiển thị.
      </p>
    </div>
  );
}
