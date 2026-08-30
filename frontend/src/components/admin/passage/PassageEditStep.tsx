import React from 'react';
import MarkdownEditor from '../../editor/MarkdownEditor';
import { PassageDraftState } from '../../../hooks/usePassageGroupDraft';

interface PassageEditStepProps {
  draft: PassageDraftState;
  updateDraft: (updates: Partial<PassageDraftState>) => void;
}

export default function PassageEditStep({ draft, updateDraft }: PassageEditStepProps) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-sm text-blue-700">
        <p><strong>Ngữ liệu chung:</strong> Đoạn văn, hình ảnh, hoặc bảng số liệu được dùng chung cho nhiều câu hỏi.</p>
        <p>Không nhập nội dung các câu hỏi con vào đây.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Nội dung ngữ liệu <span className="text-red-500">*</span>
        </label>
        <MarkdownEditor 
          value={draft.passageContent} 
          onChange={(val) => updateDraft({ passageContent: val })} 
          placeholder="Nhập nội dung ngữ liệu chung ở đây (hỗ trợ Markdown, chèn ảnh...)"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nguồn (Tác giả/Tổ chức)
          </label>
          <input 
            type="text"
            className="w-full border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ví dụ: Báo Thanh Niên, Bộ GD&ĐT..."
            value={draft.sourceAuthor}
            onChange={(e) => updateDraft({ sourceAuthor: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tiêu đề nguồn (Tên sách/báo)
          </label>
          <input 
            type="text"
            className="w-full border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ví dụ: Đề tham khảo 2024..."
            value={draft.sourceTitle}
            onChange={(e) => updateDraft({ sourceTitle: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
