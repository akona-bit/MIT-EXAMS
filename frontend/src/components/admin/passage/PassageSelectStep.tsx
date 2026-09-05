import { useState, useEffect } from 'react';
import { passageApi, PassageSearchResponse } from '../../../api/passages';
import { PassageDraftState } from '../../../hooks/usePassageGroupDraft';
import { toast } from '../../ui/Toast';

interface PassageSelectStepProps {
  draft: PassageDraftState;
  updateDraft: (updates: Partial<PassageDraftState>) => void;
  onNext: () => void;
}

export default function PassageSelectStep({ updateDraft, onNext }: PassageSelectStepProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PassageSearchResponse['results']>([]);
  const [loading, setLoading] = useState(false);
  
  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await passageApi.search(query);
      setResults(res.results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  
  // Optional: debounce search
  useEffect(() => {
    const t = setTimeout(handleSearch, 500);
    return () => clearTimeout(t);
  }, [query]);
  
  const handleSelect = async (code: string) => {
    try {
      // Fetch full passage data
      const res = await passageApi.getByCode(code);
      
      // Load questions into draft
      const loadedQuestions = (res.questions || []).map((q: any) => ({
        public_code: q.public_code,
        content: q.content,
        level: q.level,
        type: q.type as 'SINGLE_CHOICE',
        primary_knowledge_node_id: q.primary_knowledge_node_id,
        secondary_knowledge_node_ids: q.secondary_knowledge_node_ids || [],
        answers: q.answers.map((a: any) => ({
          content: a.content,
          is_correct: a.is_correct,
          position: a.position
        }))
      }));
      
      updateDraft({
        public_code: code,
        passageContent: res.content,
        sourceAuthor: res.source_author || '',
        sourceTitle: res.source_title || '',
        questions: loadedQuestions,
      });
      onNext();
    } catch (e) {
      console.error(e);
      toast.error('Lỗi tải dữ liệu ngữ liệu');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-2 text-slate-800">Tạo mới hoàn toàn</h3>
        <p className="text-slate-500 mb-4 text-sm">Nếu bạn muốn thêm một ngữ liệu hoàn toàn mới chưa từng có trong hệ thống.</p>
        <button 
          onClick={() => {
            updateDraft({ public_code: undefined, passageContent: '', sourceAuthor: '', sourceTitle: '', questions: [] });
            onNext();
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 font-medium"
        >
          + Tạo ngữ liệu mới
        </button>
      </div>

      <div className="relative flex py-5 items-center">
        <div className="flex-grow border-t border-slate-300"></div>
        <span className="flex-shrink-0 mx-4 text-slate-400 text-sm font-medium">HOẶC CHỌN TỪ KHO NGỮ LIỆU CŨ</span>
        <div className="flex-grow border-t border-slate-300"></div>
      </div>

      <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm">
        <div className="mb-4">
          <input 
            type="text" 
            placeholder="Tìm kiếm theo từ khoá nội dung, tác giả, tiêu đề..."
            className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        
        {loading && <div className="text-sm text-slate-500">Đang tìm kiếm...</div>}
        
        <div className="space-y-3">
          {!loading && results.map(r => (
            <div key={r.public_code} className="p-4 border border-slate-200 rounded hover:bg-slate-50 flex justify-between items-center transition-colors">
              <div>
                <p className="font-medium text-slate-800">{r.preview}</p>
                <div className="flex gap-4 mt-1 text-xs text-slate-500">
                  <span>Mã: {r.public_code}</span>
                  {r.source_title && <span>Nguồn: {r.source_title}</span>}
                  <span className="text-blue-600 font-medium">Đang có {r.question_count} câu hỏi</span>
                </div>
              </div>
              <button 
                onClick={() => handleSelect(r.public_code)}
                className="px-3 py-1 bg-white border border-slate-300 rounded text-sm font-medium hover:bg-slate-100"
              >
                Chọn
              </button>
            </div>
          ))}
          {!loading && results.length === 0 && query && (
            <div className="text-sm text-slate-500 italic">Không tìm thấy kết quả phù hợp.</div>
          )}
        </div>
      </div>
    </div>
  );
}
