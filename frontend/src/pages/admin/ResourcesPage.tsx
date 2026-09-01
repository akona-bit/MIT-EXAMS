import { useEffect, useState } from "react";
import {
  passageApi,
  PassageSearchResponse,
} from "../../api/passages";
import Button from "../../components/ui/Button";
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
} from "lucide-react";
import PassageEditStep from "../../components/admin/passage/PassageEditStep";
import Modal from "../../components/ui/Modal";

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
  { id: "van-ban", label: "Văn bản", icon: <BookOpen className="h-4 w-4" />, description: "Đoạn văn, bài đọc hiểu dùng chung cho câu hỏi chùm", createLabel: "Thêm ngữ liệu văn bản" },
  { id: "bang", label: "Bảng biểu", icon: <Table2 className="h-4 w-4" />, description: "Bảng dữ liệu, biểu đồ, sơ đồ dùng trong câu hỏi", createLabel: "Thêm bảng biểu" },
  { id: "anh", label: "Hình ảnh", icon: <Image className="h-4 w-4" />, description: "Ảnh minh họa, biểu đồ, sơ đồ, tranh vẽ", createLabel: "Thêm hình ảnh" },
  { id: "pdf", label: "Tài liệu PDF", icon: <FileText className="h-4 w-4" />, description: "Tài liệu PDF, scan từ sách/bộ đề", createLabel: "Thêm tài liệu PDF" },
  { id: "viet-tay", label: "Viết tay", icon: <PenTool className="h-4 w-4" />, description: "Ngữ liệu viết tay, scan phiếu trả lời", createLabel: "Thêm ngữ liệu viết tay" },
];

interface ResourceItem {
  id: string;
  name: string;
  preview: string;
  type: ResourceTab;
  questionCount: number;
  createdAt: string;
}

/* ── Main page ────────────────────────────────────────────── */

export default function ResourcesPage() {
  const [activeTab, setActiveTab] = useState<ResourceTab>("van-ban");

  // Passage state (van-ban tab)
  const [passages, setPassages] = useState<PassageSearchResponse["results"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Generic resource items for non-van-ban tabs (localStorage-backed for now)
  const [resourceItems, setResourceItems] = useState<ResourceItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("mit-resources") || "[]");
    } catch {
      return [];
    }
  });

  // Modal State for Create/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Passage draft
  const [passageDraft, setPassageDraft] = useState({
    passageContent: "",
    sourceAuthor: "",
    sourceTitle: "",
  });

  // Generic resource draft
  const [resourceDraft, setResourceDraft] = useState({
    name: "",
    description: "",
    content: "", // markdown/table data
    file: null as File | null,
    filePreview: "",
  });

  /* ── Passage CRUD ──────────────────────────────────────── */

  const loadPassages = async () => {
    setIsLoading(true);
    try {
      const res = await passageApi.search(search, 100);
      setPassages(res.results);
      setError("");
    } catch {
      setError("Không thể tải kho ngữ liệu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "van-ban") loadPassages();
  }, [search, activeTab]);

  const handleOpenCreatePassage = () => {
    setPassageDraft({ passageContent: "", sourceAuthor: "", sourceTitle: "" });
    setEditingId(null);
    setModalMode("create");
    setIsModalOpen(true);
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
      alert("Vui lòng nhập nội dung ngữ liệu");
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
      loadPassages();
    } catch {
      alert("Có lỗi xảy ra khi lưu ngữ liệu.");
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Generic resource CRUD (localStorage) ─────────────── */

  const persistResources = (items: ResourceItem[]) => {
    setResourceItems(items);
    localStorage.setItem("mit-resources", JSON.stringify(items));
  };

  const handleOpenCreateResource = () => {
    setResourceDraft({ name: "", description: "", content: "", file: null, filePreview: "" });
    setEditingId(null);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const handleOpenEditResource = (item: ResourceItem) => {
    setResourceDraft({
      name: item.name,
      description: item.preview,
      content: "",
      file: null,
      filePreview: "",
    });
    setEditingId(item.id);
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const handleSaveResource = () => {
    if (!resourceDraft.name.trim()) {
      alert("Vui lòng nhập tên ngữ liệu");
      return;
    }
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      if (modalMode === "edit" && editingId) {
        persistResources(
          resourceItems.map((r) =>
            r.id === editingId ? { ...r, name: resourceDraft.name, preview: resourceDraft.description } : r
          )
        );
      } else {
        const newItem: ResourceItem = {
          id: `${activeTab}-${Date.now()}`,
          name: resourceDraft.name,
          preview: resourceDraft.description,
          type: activeTab,
          questionCount: 0,
          createdAt: now,
        };
        persistResources([...resourceItems, newItem]);
      }
      setIsModalOpen(false);
    } catch {
      alert("Có lỗi xảy ra khi lưu.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteResource = (id: string) => {
    if (!window.confirm("Xác nhận xóa ngữ liệu này?")) return;
    persistResources(resourceItems.filter((r) => r.id !== id));
  };

  const currentTab = tabs.find((t) => t.id === activeTab)!;

  const filteredResources = resourceItems.filter((r) => r.type === activeTab);

  const isPassageTab = activeTab === "van-ban";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">Kho ngữ liệu</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Quản lý các loại ngữ liệu dùng trong đề thi và câu hỏi.
          </p>
        </div>
        <Button
          onClick={isPassageTab ? handleOpenCreatePassage : handleOpenCreateResource}
          size="lg"
          className="w-full sm:w-auto shadow-lg shadow-primary-500/30 hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {currentTab.createLabel}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-slate-200/60 bg-white/60 p-1 dark:border-slate-700/60 dark:bg-slate-900/60 overflow-x-auto">
        {tabs.map((tab) => {
          const count = tab.id === "van-ban" ? passages.length : resourceItems.filter((r) => r.type === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-white text-primary-600 shadow-sm dark:bg-slate-800 dark:text-primary-400"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5"
              }`}
            >
              {tab.icon}
              {tab.label}
              {count > 0 && (
                <span className="ml-1 rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab description */}
      <p className="text-sm text-slate-500 dark:text-slate-400">{currentTab.description}</p>

      {/* Error */}
      {error && (
        <div role="alert" className="rounded-xl border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          {error}
        </div>
      )}

      {/* Tab Content */}
      {isPassageTab ? (
        <VanBanTab
          passages={passages}
          isLoading={isLoading}
          search={search}
          setSearch={setSearch}
          onEdit={handleOpenEditPassage}
        />
      ) : (
        <ResourceListTab
          items={filteredResources}
          tab={currentTab}
          onEdit={handleOpenEditResource}
          onDelete={handleDeleteResource}
        />
      )}

      {/* Modal: Passage create/edit */}
      {isPassageTab && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => !isSaving && setIsModalOpen(false)}
          title={modalMode === "edit" ? "Chỉnh sửa ngữ liệu" : "Thêm ngữ liệu văn bản"}
          maxWidth="max-w-5xl"
        >
          <div className="p-6">
            <PassageEditStep
              draft={passageDraft as any}
              updateDraft={(u) => setPassageDraft((p) => ({ ...p, ...u }))}
            />
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                Hủy
              </Button>
              <Button onClick={handleSavePassage} isLoading={isSaving}>
                {modalMode === "edit" ? "Cập nhật" : "Tạo ngữ liệu"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Resource create/edit */}
      {!isPassageTab && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => !isSaving && setIsModalOpen(false)}
          title={modalMode === "edit" ? `Chỉnh sửa ${currentTab.label.toLowerCase()}` : currentTab.createLabel}
          maxWidth="max-w-3xl"
        >
          <div className="p-6">
            <ResourceForm
              tab={activeTab}
              draft={resourceDraft}
              setDraft={setResourceDraft}
            />
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                Hủy
              </Button>
              <Button onClick={handleSaveResource} isLoading={isSaving}>
                {modalMode === "edit" ? "Cập nhật" : "Tạo mới"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Van Ban Tab ──────────────────────────────────────────── */

function VanBanTab({
  passages,
  isLoading,
  search,
  setSearch,
  onEdit,
}: {
  passages: PassageSearchResponse["results"];
  isLoading: boolean;
  search: string;
  setSearch: (v: string) => void;
  onEdit: (code: string) => void;
}) {
  return (
    <>
      <div className="relative max-w-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          className="block w-full rounded-xl border-slate-200 pl-10 focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:border-slate-700 dark:bg-slate-900/50"
          placeholder="Tìm kiếm ngữ liệu văn bản..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && passages.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200/60 dark:border-slate-700/60 glass-card">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
        </div>
      ) : passages.length === 0 ? (
        <EmptyState message="Chưa có ngữ liệu văn bản nào" hint="Nhấn nút &quot;Thêm ngữ liệu văn bản&quot; để bắt đầu." />
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
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 italic">"{p.preview}"</p>
              </div>
              <div className="mt-4 flex items-center justify-end border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => onEdit(p.public_code)}
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
    </>
  );
}

/* ── Resource List Tab (bang, anh, pdf, viet-tay) ──────────── */

function ResourceListTab({
  items,
  tab,
  onEdit,
  onDelete,
}: {
  items: ResourceItem[];
  tab: TabDef;
  onEdit: (item: ResourceItem) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = items.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.preview.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="relative max-w-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          className="block w-full rounded-xl border-slate-200 pl-10 focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:border-slate-700 dark:bg-slate-900/50"
          placeholder={`Tìm kiếm ${tab.label.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          message={`Chưa có ${tab.label.toLowerCase()} nào`}
          hint={`Nhấn nút "${tab.createLabel}" để bắt đầu.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg glass-card transition hover:-translate-y-0.5 hover:shadow-xl p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-primary-500">{tab.icon}</span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                      {item.id}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                    {item.questionCount} câu hỏi
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 mb-1">
                  {item.name}
                </h3>
                {item.preview && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 italic">"{item.preview}"</p>
                )}
              </div>
              <div className="mt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  <Edit3 className="w-4 h-4" />
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

/* ── Resource Form (for non-van-ban tabs) ─────────────────── */

function ResourceForm({
  tab,
  draft,
  setDraft,
}: {
  tab: ResourceTab;
  draft: { name: string; description: string; content: string; file: File | null; filePreview: string };
  setDraft: React.Dispatch<React.SetStateAction<typeof draft>>;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDraft((prev) => ({ ...prev, file, filePreview: URL.createObjectURL(file) }));
  };

  const removeFile = () => {
    setDraft((prev) => ({ ...prev, file: null, filePreview: "" }));
  };

  return (
    <div className="space-y-5">
      {/* Name */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
          Tên ngữ liệu <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900/50"
          placeholder={
            tab === "bang" ? "Ví dụ: Bảng so sánh hệ mặt trời" :
            tab === "anh" ? "Ví dụ: Sơ đồ chu trình nước" :
            tab === "pdf" ? "Ví dụ: Đề tham khảo 2024" :
            "Ví dụ: Phiếu trả lời THPT Quốc gia"
          }
          value={draft.name}
          onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
          Mô tả / Ghi chú
        </label>
        <textarea
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900/50"
          rows={3}
          placeholder="Mô tả ngắn gọn về ngữ liệu..."
          value={draft.description}
          onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
        />
      </div>

      {/* File upload (for bang, anh, pdf, viet-tay) */}
      {(tab === "anh" || tab === "pdf" || tab === "viet-tay") && (
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
            Tải tệp lên <span className="text-red-500">*</span>
          </label>
          {draft.file ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              {tab === "anh" && draft.filePreview && (
                <img src={draft.filePreview} alt="" className="h-12 w-12 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{draft.file.name}</p>
                <p className="text-xs text-slate-500">{(draft.file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={removeFile} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-red-500 dark:hover:bg-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white/50 px-6 py-8 text-center transition hover:border-primary-400 hover:bg-primary-50/50 dark:border-slate-600 dark:hover:border-primary-500">
              <Upload className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Nhấn để tải lên hoặc kéo thả
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {tab === "anh" && "PNG, JPG, SVG (tối đa 5MB)"}
                  {tab === "pdf" && "PDF (tối đa 20MB)"}
                  {tab === "viet-tay" && "PNG, JPG, PDF (tối đa 10MB)"}
                </p>
              </div>
              <input type="file" className="hidden" accept={
                tab === "anh" ? "image/*" :
                tab === "pdf" ? ".pdf" :
                "image/*,.pdf"
              } onChange={handleFileChange} />
            </label>
          )}
        </div>
      )}

      {/* Table content (for bang tab) */}
      {tab === "bang" && (
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
            Nội dung bảng <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-2">Dán nội dung bảng dạng text, Markdown, hoặc mô tả cấu trúc bảng.</p>
          <textarea
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-sm focus:border-primary-500 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900/50"
            rows={8}
            placeholder={"| Hành tinh | Khối lượng (kg) | Bán kính (km) |\n|----------|----------------|-------------|\n| Thủy Ngân | 3.30×10²³     | 2.439       |\n| Kim Tinh | 4.87×10²⁴     | 6.052       |"}
            value={draft.content}
            onChange={(e) => setDraft((p) => ({ ...p, content: e.target.value }))}
          />
        </div>
      )}
    </div>
  );
}

/* ── Shared empty state ───────────────────────────────────── */

function EmptyState({ message, hint }: { message: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-900/40 px-6 py-16 text-center">
      <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">{message}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}
