import { useEffect, useState } from "react";
import {
  passageApi,
  PassageSearchResponse,
} from "../../api/passages";
import { resourceApi, ResourceResponse, TAB_TYPE_MAP } from "../../api/resources";
import Button from "../../components/ui/Button";
import { toast } from "../../components/ui/Toast";
import {
  BookOpen,
  Search,
  Edit3,
  Image,
  FileText,
  PenTool,
  Table2,
  Upload,
  Plus,
  Trash2,
  X,
  Library,
  Layers,
} from "lucide-react";
import MarkdownEditor from "../../components/editor/MarkdownEditor";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

/* ── Types ────────────────────────────────────────────────── */

type ResourceTab = "van-ban" | "bang" | "anh" | "pdf" | "viet-tay";

interface TabDef {
  id: ResourceTab;
  label: string;
  icon: React.ReactNode;
  description: string;
  createLabel: string;
}

const tabs: TabDef[] = [
  { id: "van-ban", label: "Văn bản", icon: <BookOpen className="h-4 w-4" />, description: "Đoạn văn, bài đọc hiểu dùng chung", createLabel: "Thêm văn bản" },
  { id: "anh", label: "Hình ảnh", icon: <Image className="h-4 w-4" />, description: "Ảnh minh họa, biểu đồ", createLabel: "Upload hình ảnh" },
  { id: "pdf", label: "Tài liệu PDF", icon: <FileText className="h-4 w-4" />, description: "Tài liệu đính kèm dạng PDF", createLabel: "Upload PDF" },
  { id: "viet-tay", label: "Viết tay", icon: <PenTool className="h-4 w-4" />, description: "Phiếu làm bài, bài viết tay (Ảnh/PDF)", createLabel: "Upload bài viết tay" },
  { id: "bang", label: "Bảng biểu", icon: <Table2 className="h-4 w-4" />, description: "Bảng dữ liệu (Markdown)", createLabel: "Thêm bảng biểu" },
];

/* ── Main page ────────────────────────────────────────────── */

export default function ResourcesPage() {
  const [activeTab, setActiveTab] = useState<ResourceTab>("van-ban");

  // Passages
  const [passages, setPassages] = useState<PassageSearchResponse["results"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Resources from DB
  const [resources, setResources] = useState<ResourceResponse[]>([]);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [passageDraft, setPassageDraft] = useState({
    passageContent: "",
    sourceAuthor: "",
    sourceTitle: "",
  });

  const [resourceDraft, setResourceDraft] = useState({
    name: "",
    description: "",
    content: "",
    file: null as File | null,
    filePreview: "",
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === "van-ban") {
        const res = await passageApi.search(search, 100);
        setPassages(res.results);
      } else {
        const resourceType = TAB_TYPE_MAP[activeTab];
        const res = await resourceApi.list(resourceType);
        setResources(res);
      }
      setError("");
    } catch {
      setError("Không thể tải kho dữ liệu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, activeTab]);

  /* ── Passage Actions ──────────────────────────── */
  const handleOpenCreatePassage = () => {
    setPassageDraft({ passageContent: "", sourceAuthor: "", sourceTitle: "" });
    setEditingId(null);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const handleDeletePassage = async (code: string) => {
    setConfirmMessage("Bạn có chắc chắn muốn xóa ngữ liệu này? Thao tác sẽ gỡ liên kết khỏi các câu hỏi nhưng không xóa nội dung câu hỏi.");
    setConfirmAction(() => async () => {
      try {
        await passageApi.delete(code);
        toast.success("Đã xóa ngữ liệu thành công");
        loadData();
      } catch (error: any) {
        toast.error(error.response?.data?.detail || "Không thể xóa ngữ liệu");
      }
    });
    setConfirmOpen(true);
  };

  const handleOpenEditPassage = async (code: string) => {
    setIsLoading(true);
    try {
      const p = await passageApi.getByCode(code);
      setPassageDraft({
        passageContent: p.content,
        sourceAuthor: p.source_author || "",
        sourceTitle: p.source_title || "",
      });
      setEditingId(code);
      setModalMode("edit");
      setIsModalOpen(true);
    } catch {
      setError("Không thể lấy chi tiết ngữ liệu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePassage = async () => {
    if (!passageDraft.passageContent.trim()) {
      toast.warning("Vui lòng nhập nội dung ngữ liệu");
      return;
    }
    setIsSaving(true);
    try {
      if (modalMode === "edit" && editingId) {
        await passageApi.update(editingId, {
          content: passageDraft.passageContent,
          source_author: passageDraft.sourceAuthor,
          source_title: passageDraft.sourceTitle,
        });
      } else {
        await passageApi.create({
          content: passageDraft.passageContent,
          source_author: passageDraft.sourceAuthor,
          source_title: passageDraft.sourceTitle,
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch {
      toast.error("Có lỗi xảy ra khi lưu ngữ liệu.");
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Resource Actions ─────────────────────────── */
  const handleOpenCreateResource = () => {
    setResourceDraft({ name: "", description: "", content: "", file: null, filePreview: "" });
    setEditingId(null);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const handleSaveResource = async () => {
    setIsSaving(true);
    try {
      let uploadFile = resourceDraft.file;
      const resourceType = TAB_TYPE_MAP[activeTab];
      
      if (activeTab === "bang") {
        if (!resourceDraft.name.trim() || !resourceDraft.content.trim()) {
          toast.warning("Vui lòng nhập đủ tên và nội dung bảng.");
          setIsSaving(false);
          return;
        }
        // Tạo file .md từ text
        const blob = new Blob([resourceDraft.content], { type: "text/markdown" });
        uploadFile = new File([blob], `${resourceDraft.name}.md`, { type: "text/markdown" });
      } else {
        if (!uploadFile) {
          toast.warning("Vui lòng chọn file.");
          setIsSaving(false);
          return;
        }
      }

      await resourceApi.upload(uploadFile, resourceType);
      setIsModalOpen(false);
      loadData();
    } catch (e: any) {
      toast.error("Upload thất bại: " + (e.response?.data?.detail || e.message));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteResource = async (id: string) => {
    try {
      await resourceApi.delete(id);
      loadData();
    } catch {
      toast.error("Không thể xóa file.");
    }
  };

  const handleDeleteResource = (id: string) => {
    setConfirmMessage("Xác nhận xóa file này khỏi Supabase?");
    setConfirmAction(() => () => { confirmDeleteResource(id); });
    setConfirmOpen(true);
  };

  const currentTab = tabs.find((t) => t.id === activeTab)!;
  const isPassageTab = activeTab === "van-ban";

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500 pt-4 px-4 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient flex items-center gap-3 pb-1">
            <Library className="w-8 h-8 text-primary-500" />
            Kho Học Liệu
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Quản lý tập trung các đoạn văn, hình ảnh, tài liệu dùng chung.
          </p>
        </div>
        <Button
          onClick={isPassageTab ? handleOpenCreatePassage : handleOpenCreateResource}
          size="lg"
          className="w-full sm:w-auto shadow-lg shadow-primary-500/30"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {currentTab.createLabel}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 rounded-2xl border border-slate-200/60 bg-white/60 p-1.5 dark:border-slate-700/60 dark:bg-slate-900/60 overflow-x-auto shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearch(""); }}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-300 ${
              activeTab === tab.id
                ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{currentTab.description}</p>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {isPassageTab ? (
        <VanBanTab
          passages={passages}
          isLoading={isLoading}
          search={search}
          setSearch={setSearch}
          onEdit={handleOpenEditPassage}
          onDelete={handleDeletePassage}
        />
      ) : (
        <ResourceListTab
          items={resources}
          isLoading={isLoading}
          tab={currentTab}
          search={search}
          setSearch={setSearch}
          onDelete={handleDeleteResource}
        />
      )}

      {/* Modal: Passage */}
      {isPassageTab && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            if (isSaving) return;
            if (passageDraft.passageContent.trim()) {
              if (!window.confirm("Bạn có thay đổi chưa lưu. Đóng sẽ mất dữ liệu.")) return;
            }
            setIsModalOpen(false);
          }}
          title={modalMode === "edit" ? "Chỉnh sửa ngữ liệu" : "Thêm ngữ liệu văn bản"}
          maxWidth="max-w-5xl"
        >
          <div className="p-6 space-y-6">
            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg shrink-0">
                <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p><strong>Ngữ liệu chung:</strong> Đoạn văn, hình ảnh, hoặc bảng số liệu được dùng chung cho nhiều câu hỏi.</p>
                <p className="mt-1">Không nhập nội dung các câu hỏi con vào đây.</p>
              </div>
            </div>

            {/* Content field */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Nội dung ngữ liệu <span className="text-red-500">*</span>
              </label>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 transition-shadow">
                <MarkdownEditor
                  value={passageDraft.passageContent}
                  onChange={(val) => setPassageDraft((p) => ({ ...p, passageContent: val }))}
                  placeholder="Nhập nội dung ngữ liệu chung ở đây (hỗ trợ Markdown, chèn ảnh...)"
                />
              </div>
              <p className="text-xs text-slate-400">Bạn có thể sử dụng cú pháp Markdown. Để thêm ảnh: {'![Hình 1](url){width=40% align-right}'}</p>
            </div>

            {/* Source fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Nguồn (Tác giả/Tổ chức)
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow"
                  placeholder="Ví dụ: Báo Thanh Niên, Bộ GD&ĐT..."
                  value={passageDraft.sourceAuthor}
                  onChange={(e) => setPassageDraft((p) => ({ ...p, sourceAuthor: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Tiêu đề nguồn (Tên sách/báo)
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow"
                  placeholder="Ví dụ: Đề tham khảo 2024..."
                  value={passageDraft.sourceTitle}
                  onChange={(e) => setPassageDraft((p) => ({ ...p, sourceTitle: e.target.value }))}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Hủy</Button>
              <Button onClick={handleSavePassage} isLoading={isSaving}>Lưu</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Resource */}
      {!isPassageTab && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => !isSaving && setIsModalOpen(false)}
          title={currentTab.createLabel}
          maxWidth="max-w-xl"
        >
          <div className="p-6">
            <ResourceForm
              tab={activeTab}
              draft={resourceDraft}
              setDraft={setResourceDraft}
            />
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Hủy</Button>
              <Button onClick={handleSaveResource} isLoading={isSaving}>Upload</Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Xác nhận"
        message={confirmMessage}
        onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }}
        onCancel={() => { setConfirmOpen(false); setConfirmAction(null); }}
        isDestructive
      />
    </div>
  );
}

function VanBanTab({ passages, isLoading, search, setSearch, onEdit, onDelete }: any) {
  return (
    <>
      <div className="relative max-w-md">
        <Search className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="block w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900/50"
          placeholder="Tìm kiếm ngữ liệu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>
      ) : passages.length === 0 ? (
        <EmptyState message="Chưa có ngữ liệu văn bản nào" hint="Nhấn Thêm văn bản để tạo mới." />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {passages.map((p: any) => (
            <article key={p.public_code} className="glass-card flex flex-col justify-between p-6 hover:-translate-y-1 transition duration-300 shadow-sm hover:shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{p.public_code}</span>
                  <span className="text-xs font-bold text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded-full">{p.question_count} câu hỏi</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 mb-2">{p.source_title || "Ngữ liệu không tên"}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 italic">"{p.preview}"</p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button onClick={() => onEdit(p.public_code)} className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"><Edit3 className="w-4 h-4"/> Sửa</button>
                <button onClick={() => onDelete(p.public_code)} className="flex items-center gap-1.5 text-sm font-semibold text-danger-500 hover:text-danger-600"><Trash2 className="w-4 h-4"/> Xóa</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function ResourceListTab({ items, isLoading, tab, search, setSearch, onDelete }: any) {
  const filtered = items.filter((r: ResourceResponse) => r.original_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="relative max-w-md">
        <Search className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="block w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900/50"
          placeholder={`Tìm kiếm ${tab.label.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState message={`Chưa có ${tab.label.toLowerCase()} nào`} hint={`Nhấn "${tab.createLabel}" để upload.`} />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item: ResourceResponse) => (
            <article key={item.id} className="glass-card overflow-hidden flex flex-col transition duration-300 hover:shadow-xl group">
              <div className="h-40 bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center p-4">
                {item.type === 'IMAGE' ? (
                   <img src={item.content_url} alt={item.original_name} className="max-h-full max-w-full object-contain rounded-md" />
                ) : item.type === 'PDF' ? (
                   <FileText className="w-16 h-16 text-red-400" />
                ) : item.type === 'HANDWRITING' ? (
                   <PenTool className="w-16 h-16 text-amber-400" />
                ) : item.type === 'CHART' ? (
                   <Table2 className="w-16 h-16 text-indigo-400" />
                ) : (
                   <BookOpen className="w-16 h-16 text-slate-400" />
                )}
                
                {/* Hover Delete Button */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button onClick={() => onDelete(item.id)} className="bg-red-500 text-white p-3 rounded-full hover:bg-red-600 shadow-lg hover:scale-110 transition-transform">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{new Date(item.created_at).toLocaleDateString('vi-VN')}</p>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={item.original_name}>
                  {item.original_name}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{(item.size_bytes / 1024).toFixed(1)} KB</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function ResourceForm({ tab, draft, setDraft }: any) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDraft((prev: any) => ({ ...prev, file, filePreview: URL.createObjectURL(file) }));
  };

  return (
    <div className="space-y-5">
      {tab === "bang" ? (
        <>
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Tên bảng biểu *</label>
            <input className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:bg-slate-900/50" value={draft.name} onChange={(e) => setDraft((p: any) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Nội dung Markdown *</label>
            <textarea className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-sm dark:bg-slate-900/50" rows={8} value={draft.content} onChange={(e) => setDraft((p: any) => ({ ...p, content: e.target.value }))} />
          </div>
        </>
      ) : (
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Tải tệp lên *</label>
          {draft.file ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{draft.file.name}</p>
                <p className="text-xs text-slate-500">{(draft.file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => setDraft((p:any) => ({...p, file: null}))} className="text-slate-400 hover:text-red-500"><X className="h-5 w-5" /></button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-100 px-6 py-12 text-center transition dark:border-slate-600 dark:bg-slate-800/20">
              <Upload className="h-8 w-8 text-slate-400" />
              <p className="text-sm font-semibold">Nhấn hoặc kéo thả file vào đây</p>
              <input type="file" className="hidden" accept={tab === "pdf" ? ".pdf" : "image/*"} onChange={handleFileChange} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ message, hint }: { message: string; hint: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/20 px-6 py-20 text-center">
      <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{message}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}
