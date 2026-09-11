import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Image } from "@tiptap/extension-image";
import { PandocImage } from "./PandocImage";
import { AnswerErrorSpanMark } from "./AnswerErrorSpan";
import { LayoutGrid, SpellCheck } from "lucide-react";
import { toast } from "../ui/Toast";
import ImageSelectorModal from "./ImageSelectorModal";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  renderStyle?: "standard" | "error_detection";
}

// Pre-process: ![alt](url){width=40% align=right} -> ![alt](url "width=40% align=right")
// And: [text]{.answer-error} -> <span class="answer-error">text</span>
const parsePandoc = (md: string) => {
  if (!md) return "";
  let parsed = md.replace(/!\[(.*?)\]\((.*?)\)\{(.*?)\}/g, '![$1]($2 "$3")');
  parsed = parsed.replace(/\[(.*?)\]\{\.answer-error\}/g, '<span class="answer-error">$1</span>');
  return parsed;
};

// Post-process: ![alt](url "width=40% align=right") -> ![alt](url){width=40% align=right}
// And: <span class="answer-error">text</span> -> [text]{.answer-error}
const serializePandoc = (md: string) => {
  if (!md) return "";
  let serialized = md.replace(
    /!\[(.*?)\]\((.*?)\s+"(.*?(?:width=|align=).*?)"\)/g,
    "![$1]($2){$3}",
  );
  serialized = serialized.replace(/<span class="answer-error">(.*?)<\/span>/g, '[$1]{.answer-error}');
  return serialized;
};

export default function MarkdownEditor({
  value,
  onChange,
  renderStyle = "standard",
}: MarkdownEditorProps) {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      PandocImage,
      Image,
      AnswerErrorSpanMark,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown.configure({
        transformPastedText: true,
        transformCopiedText: true,
        html: false, // Export Markdown, not HTML
      }),
    ],
    content: parsePandoc(value),
    editorProps: {
      attributes: {
        class:
          "prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[150px] p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 prose-table:border-collapse prose-table:w-full prose-td:border prose-td:border-slate-300 prose-td:p-2 prose-th:border prose-th:border-slate-300 prose-th:p-2 prose-th:bg-slate-100 dark:prose-th:bg-slate-800 [counter-reset:answer-error]",
      },
    },
    onUpdate: ({ editor }) => {
      let md = (editor.storage as any).markdown.getMarkdown();
      onChange(serializePandoc(md));
    },
  });

  useEffect(() => {
    if (editor) {
      const currentMd = serializePandoc(
        (editor.storage as any).markdown.getMarkdown(),
      );
      if (value !== currentMd) {
        editor.commands.setContent(parsePandoc(value));
      }
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="markdown-editor-wrapper flex flex-col gap-2">
      {/* Basic Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition"
        >
          <LayoutGrid className="w-4 h-4" />
          Chèn bảng
        </button>
        {renderStyle === "error_detection" && (
          <button
            type="button"
            onClick={() => {
              if (editor.isActive("answerErrorSpan")) {
                editor.chain().focus().unsetMark("answerErrorSpan").run();
              } else {
                const doc = editor.state.doc;
                let spanCount = 0;
                doc.descendants((node, pos) => {
                  if (node.isText && node.marks.some(m => m.type.name === 'answerErrorSpan')) {
                    // This counts segments, not exact spans, but usually sufficient.
                    // Better to just count in the current markdown.
                  }
                });
                const md = (editor.storage as any).markdown.getMarkdown();
                const matchCount = (md.match(/\[.*?\]\{\.answer-error\}/g) || []).length;
                if (matchCount >= 4) {
                  toast.error("Chỉ được đánh dấu tối đa 4 cụm từ lỗi.");
                } else {
                  editor.chain().focus().toggleMark("answerErrorSpan").run();
                }
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition ${
              editor.isActive("answerErrorSpan")
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200"
                : "text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <SpellCheck className="w-4 h-4" />
            Đánh dấu lỗi sai
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsImageModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          Chèn ảnh
        </button>
        {editor.isActive("table") && (
          <>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              className="px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-600"
            >
              + Cột trái
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-600"
            >
              + Cột phải
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className="px-2 py-1 text-xs text-danger-600 bg-danger-50 border border-danger-200 rounded hover:bg-danger-100"
            >
              Xóa cột
            </button>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowBefore().run()}
              className="px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-600"
            >
              + Dòng trên
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-600"
            >
              + Dòng dưới
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteRow().run()}
              className="px-2 py-1 text-xs text-danger-600 bg-danger-50 border border-danger-200 rounded hover:bg-danger-100"
            >
              Xóa dòng
            </button>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="px-2 py-1 text-xs text-white bg-danger-500 rounded hover:bg-danger-600"
            >
              Xóa bảng
            </button>
          </>
        )}
      </div>

      <EditorContent editor={editor} />
      
      <ImageSelectorModal 
        isOpen={isImageModalOpen} 
        onClose={() => setIsImageModalOpen(false)}
        onSelect={(url) => editor.chain().focus().setImage({ src: url }).run()}
      />
    </div>
  );
}
