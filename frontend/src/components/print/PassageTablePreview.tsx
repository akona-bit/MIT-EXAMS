import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface PassageTablePreviewProps {
  content: string;
  sourceAuthor?: string;
  sourceTitle?: string;
}

export default function PassageTablePreview({
  content,
  sourceAuthor,
  sourceTitle,
}: PassageTablePreviewProps) {
  return (
    <div>
      <div className="passage-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            table: ({ children }) => (
              <table className="print-table">{children}</table>
            ),
            img: ({ ...props }) => (
              <img {...props} style={{ maxWidth: "100%" }} />
            ),
          }}
        >
          {content || "*Chưa có nội dung*"}
        </ReactMarkdown>

        {(sourceAuthor || sourceTitle) && (
          <div className="passage-source">
            Nguồn: {sourceAuthor}
            {sourceTitle ? ` - ${sourceTitle}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
