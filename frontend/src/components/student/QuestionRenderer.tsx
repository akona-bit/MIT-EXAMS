import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface QuestionRendererProps {
  question: any;
  answer: any;
  onChange: (payload: any) => void;
}

// ─── Hàng ý con dạng Đúng/Sai (TRUE_FALSE và ý tf của COMPOSITE) ───
function TrueFalseRow({
  label,
  prompt,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  prompt: string | null;
  options: any[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-2.5 mb-3">
        <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800 text-white text-xs font-bold">
          {label}
        </span>
        {prompt && (
          <div className="flex-1 prose prose-sm max-w-none text-slate-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {prompt}
            </ReactMarkdown>
          </div>
        )}
      </div>
      <div className="flex gap-3">
        {options.map((opt, i) => {
          const isSelected = selectedId === opt.id;
          const isTrue = i === 0;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={`flex-1 py-2.5 rounded-lg border-2 font-semibold text-sm transition-all duration-150 ${
                isSelected
                  ? isTrue
                    ? "bg-green-50 border-green-500 text-green-700 shadow-sm"
                    : "bg-red-50 border-red-500 text-red-700 shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <span className="mr-1.5">{isTrue ? "✓" : "✗"}</span>
              {opt.content || (isTrue ? "Đúng" : "Sai")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Hàng ý con dạng chọn 1 / chọn nhiều (COMPOSITE) ───
function SubItemOptionsRow({
  label,
  prompt,
  kind,
  options,
  selected,
  onSelect,
}: {
  label: string;
  prompt: string | null;
  kind: string;
  options: any[];
  selected: number | number[] | null;
  onSelect: (value: number | number[]) => void;
}) {
  const selectedIds: number[] = Array.isArray(selected)
    ? selected
    : selected != null
      ? [selected]
      : [];

  const handleSelect = (optId: number) => {
    if (kind === "multi") {
      const next = selectedIds.includes(optId)
        ? selectedIds.filter((x) => x !== optId)
        : [...selectedIds, optId];
      onSelect(next);
    } else {
      onSelect(optId);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-2.5 mb-3">
        <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800 text-white text-xs font-bold">
          {label}
        </span>
        {prompt && (
          <div className="flex-1 prose prose-sm max-w-none text-slate-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {prompt}
            </ReactMarkdown>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {options.map((opt, i) => {
          const isChecked = selectedIds.includes(opt.id);
          const letter = String.fromCharCode(65 + i);
          return (
            <label
              key={opt.id}
              className={`flex items-start gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all duration-150 ${
                isChecked
                  ? "bg-blue-50 border-blue-500"
                  : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div
                className={`mt-0.5 flex items-center justify-center w-6 h-6 shrink-0 border-2 text-[10px] font-bold transition-colors ${
                  kind === "multi" ? "rounded-md" : "rounded-full"
                } ${
                  isChecked
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-slate-300 text-slate-500"
                }`}
              >
                {letter}
              </div>
              <input
                type={kind === "multi" ? "checkbox" : "radio"}
                name={`sub-${label}-${prompt?.slice(0, 10) || ""}`}
                checked={isChecked}
                onChange={() => handleSelect(opt.id)}
                className="sr-only"
              />
              <div className="flex-1 prose prose-sm max-w-none text-slate-700 pt-0.5">
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

  // ─── TRUE / FALSE (nhiều ý con: mỗi ý chọn Đúng/Sai) ───
  if (type === "TRUE_FALSE" && question.sub_items?.length) {
    const subAnswers = answer?.selected_subitem_answers || {};
    const getSelected = (subId: number): number | null => {
      const v = subAnswers[subId] ?? subAnswers[String(subId)];
      return v != null && !Array.isArray(v) ? Number(v) : null;
    };
    return (
      <div className="space-y-4">
        <div className="prose prose-sm max-w-none text-slate-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {question.content}
          </ReactMarkdown>
        </div>
        <p className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-md inline-block mt-5">
          Chọn Đúng hoặc Sai cho từng ý — điểm tăng theo số ý đúng
        </p>
        <div className="space-y-3">
          {question.sub_items.map((si: any) => (
            <TrueFalseRow
              key={si.id}
              label={si.label}
              prompt={si.prompt}
              options={si.options || []}
              selectedId={getSelected(si.id)}
              onSelect={(id) =>
                onChange({
                  selected_subitem_answers: { ...subAnswers, [si.id]: id },
                })
              }
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── COMPOSITE (câu hỏi chùm: nhiều ý con, mỗi ý có dạng riêng) ───
  if (type === "COMPOSITE" && question.sub_items?.length) {
    const subAnswers = answer?.selected_subitem_answers || {};
    const getSelected = (subId: number): number | number[] | null => {
      const v = subAnswers[subId] ?? subAnswers[String(subId)];
      return v != null ? v : null;
    };
    return (
      <div className="space-y-4">
        <div className="prose prose-sm max-w-none text-slate-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {question.content}
          </ReactMarkdown>
        </div>
        <p className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-md inline-block mt-5">
          Câu hỏi chùm — trả lời từng ý con bên dưới
        </p>
        <div className="space-y-3">
          {question.sub_items.map((si: any) =>
            si.kind === "tf" ? (
              <TrueFalseRow
                key={si.id}
                label={si.label}
                prompt={si.prompt}
                options={si.options || []}
                selectedId={
                  typeof getSelected(si.id) === "number"
                    ? (getSelected(si.id) as number)
                    : null
                }
                onSelect={(id) =>
                  onChange({
                    selected_subitem_answers: { ...subAnswers, [si.id]: id },
                  })
                }
              />
            ) : (
              <SubItemOptionsRow
                key={si.id}
                label={si.label}
                prompt={si.prompt}
                kind={si.kind || "single"}
                options={si.options || []}
                selected={getSelected(si.id)}
                onSelect={(value) =>
                  onChange({
                    selected_subitem_answers: { ...subAnswers, [si.id]: value },
                  })
                }
              />
            )
          )}
        </div>
      </div>
    );
  }

  // ─── TRUE / FALSE (legacy: không có ý con — chỉ 1 ô Đúng/Sai) ───
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
