import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { PandocImage } from './PandocImage'
import { LayoutGrid, Type, Image as ImageIcon } from 'lucide-react'

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Pre-process: ![alt](url){width=40% align=right} -> ![alt](url "width=40% align=right")
const parsePandoc = (md: string) => {
  if (!md) return '';
  return md.replace(/!\[(.*?)\]\((.*?)\)\{(.*?)\}/g, '![$1]($2 "$3")');
}

// Post-process: ![alt](url "width=40% align=right") -> ![alt](url){width=40% align=right}
const serializePandoc = (md: string) => {
  if (!md) return '';
  return md.replace(/!\[(.*?)\]\((.*?)\s+"(.*?(?:width=|align=).*?)"\)/g, '![$1]($2){$3}');
}

export default function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      PandocImage,
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
        class: 'prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[150px] p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 prose-table:border-collapse prose-table:w-full prose-td:border prose-td:border-slate-300 prose-td:p-2 prose-th:border prose-th:border-slate-300 prose-th:p-2 prose-th:bg-slate-100 dark:prose-th:bg-slate-800',
      },
    },
    onUpdate: ({ editor }) => {
      let md = editor.storage.markdown.getMarkdown();
      onChange(serializePandoc(md));
    },
  });

  useEffect(() => {
    if (editor) {
      const currentMd = serializePandoc(editor.storage.markdown.getMarkdown());
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
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition"
        >
          <LayoutGrid className="w-4 h-4" />
          Chèn bảng
        </button>
        {editor.isActive('table') && (
          <>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()} className="px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-600">+ Cột trái</button>
            <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-600">+ Cột phải</button>
            <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className="px-2 py-1 text-xs text-danger-600 bg-danger-50 border border-danger-200 rounded hover:bg-danger-100">Xóa cột</button>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()} className="px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-600">+ Dòng trên</button>
            <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-600">+ Dòng dưới</button>
            <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className="px-2 py-1 text-xs text-danger-600 bg-danger-50 border border-danger-200 rounded hover:bg-danger-100">Xóa dòng</button>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="px-2 py-1 text-xs text-white bg-danger-500 rounded hover:bg-danger-600">Xóa bảng</button>
          </>
        )}
      </div>
      
      <EditorContent editor={editor} />
      
      <div className="text-xs text-slate-500">
        Bạn có thể sử dụng cú pháp Markdown. Để thêm ảnh: <code>![Hình 1](url)&#123;width=40% align=right&#125;</code>
      </div>
    </div>
  )
}
