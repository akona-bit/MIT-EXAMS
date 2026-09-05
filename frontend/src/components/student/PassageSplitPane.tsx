import { useState, useEffect } from "react";
import api from "../../api/client";
import QuestionRenderer from "./QuestionRenderer";
import { sanitizeHtml } from "../../utils/sanitize";

interface PassageSplitPaneProps {
  question: any;
  answer: any;
  onChange: (payload: any) => void;
}

export default function PassageSplitPane({
  question,
  answer,
  onChange,
}: PassageSplitPaneProps) {
  const [passage, setPassage] = useState<any>(null);

  useEffect(() => {
    if (question.passage_id) {
      api
        .get(`/api/v1/passages/${question.passage_id}`)
        .then((res) => {
          setPassage(res.data);
        })
        .catch(console.error);
    }
  }, [question.passage_id]);

  return (
    <div className="flex flex-col md:flex-row h-full gap-4 max-w-7xl mx-auto">
      {/* Nửa trái: Đoạn văn (Passage) */}
      <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border overflow-y-auto">
        <h3 className="font-bold text-gray-700 mb-4 border-b pb-2 text-lg">
          Ngữ liệu
        </h3>
        {passage ? (
          <div
            className="prose max-w-none text-gray-800"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(passage.content) }}
          />
        ) : (
          <div className="animate-pulse flex flex-col gap-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        )}
      </div>

      {/* Nửa phải: Câu hỏi */}
      <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border overflow-y-auto">
        <div className="mb-6 flex justify-between items-center border-b pb-4">
          <h2 className="text-lg font-bold">
            Câu {question.position} (Phần {question.part})
          </h2>
        </div>

        <QuestionRenderer
          question={question}
          answer={answer}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
