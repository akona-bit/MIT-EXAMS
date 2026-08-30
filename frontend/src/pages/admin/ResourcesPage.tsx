import { useEffect, useState } from "react";
import {
  passageApi,
  PassageSearchResponse,
} from "../../api/passages";
import Button from "../../components/ui/Button";
import { BookOpen, Search, Edit3 } from "lucide-react";
import PassageEditStep from "../../components/admin/passage/PassageEditStep";
import { PassageDraftState } from "../../hooks/usePassageGroupDraft";
import Modal from "../../components/ui/Modal";

export default function ResourcesPage() {
  const [passages, setPassages] = useState<PassageSearchResponse["results"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  
  // Modal State for Create/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<PassageDraftState>({
    passageContent: "",
    sourceAuthor: "",
    sourceTitle: "",
  });
  const [editingCode, setEditingCode] = useState<string | null>(null);

  const loadPassages = async () => {
    setIsLoading(true);
    try {
      const res = await passageApi.search(search, 100);
      setPassages(res.results);
      setError("");
    } catch (requestError) {
      console.error(requestError);
      setError("Không thể tải kho ngữ liệu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPassages();
  }, [search]);

  const updateDraft = (updates: Partial<PassageDraftState>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const handleOpenCreate = () => {
    setDraft({ passageContent: "", sourceAuthor: "", sourceTitle: "" });
    setEditingCode(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (code: string) => {
    setIsLoading(true);
    try {
      const p = await passageApi.getByCode(code);
      setDraft({
        passageContent: p.content,
        sourceAuthor: p.source_author || "",
        sourceTitle: p.source_title || "",
      });
      setEditingCode(code);
      setIsModalOpen(true);
    } catch (err) {
      console.error(err);
      setError("Không thể lấy chi tiết ngữ liệu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!draft.passageContent.trim()) {
      alert("Vui lòng nhập nội dung ngữ liệu");
      return;
    }
    setIsSaving(true);
    try {
      if (editingCode) {
        await passageApi.update(editingCode, {
          content: draft.passageContent,
          source_author: draft.sourceAuthor,
          source_title: draft.sourceTitle,
        });
      } else {
        await passageApi.create({
          content: draft.passageContent,
          source_author: draft.sourceAuthor,
          source_title: draft.sourceTitle,
        });
      }
      setIsModalOpen(false);
      loadPassages();
    } catch (err) {
      console.error(err);
      alert("Có lỗi xảy ra khi lưu ngữ liệu.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">
            Kho ngữ liệu
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Quản lý các đoạn văn, bài đọc hiểu, bảng biểu dùng chung cho các câu hỏi.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          size="lg" 
          className="w-full sm:w-auto shadow-lg shadow-primary-500/30 hover:-translate-y-0.5"
        >
          + Ngữ liệu mới
        </Button>
      </div>

      <div className="relative max-w-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          className="block w-full rounded-xl border-slate-200 pl-10 focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:border-slate-700 dark:bg-slate-900/50"
          placeholder="Tìm kiếm ngữ liệu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-500"
        >
          {error}
        </div>
      )}

      {isLoading && passages.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200/60 dark:border-slate-700/60 glass-card">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
        </div>
      ) : passages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-900/40 px-6 py-16 text-center">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Không tìm thấy ngữ liệu nào
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Tạo ngữ liệu mới để sử dụng trong các câu hỏi chùm.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {passages.map((p) => (
            <article
              key={p.public_code}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg glass-card transition hover:-translate-y-0.5 hover:shadow-xl p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary-500" />
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                      {p.public_code}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                    {p.question_count} câu hỏi
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 mb-1" title={p.source_title || "Không rõ nguồn"}>
                  {p.source_title || "Ngữ liệu không tên"}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 italic">
                  "{p.preview}"
                </p>
              </div>
              <div className="mt-4 flex items-center justify-end border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(p.public_code)}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  <Edit3 className="w-4 h-4" />
                  Sửa
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal Edit/Create Passage */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingCode ? "Chỉnh sửa ngữ liệu" : "Thêm ngữ liệu mới"}
        size="5xl"
      >
        <div className="p-6">
          <PassageEditStep draft={draft} updateDraft={updateDraft} />
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              Hủy
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              Lưu ngữ liệu
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
