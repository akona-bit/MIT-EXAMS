import { useEffect, useRef, useState } from "react";
import {
  getResources,
  uploadResource,
  deleteResource,
  type Resource,
} from "../../api/resources";
import Button from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const typeLabel: Record<Resource["type"], string> = {
  IMAGE: "Hình ảnh",
  PDF: "PDF",
  TEXT: "Văn bản",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadResources = async () => {
    setIsLoading(true);
    try {
      setResources(await getResources());
      setError("");
    } catch (requestError) {
      console.error(requestError);
      setError("Không thể tải kho ngữ liệu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsUploading(true);
    setError("");
    try {
      await uploadResource(file);
      await loadResources();
    } catch (requestError: any) {
      const detail = requestError.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((e: any) => e.msg).join("; ")
            : "Không thể tải ngữ liệu lên.";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteResource(deleteId);
      setResources((current) =>
        current.filter((resource) => resource.id !== deleteId),
      );
    } catch (requestError: any) {
      if (requestError.response?.status === 404) {
        // Idempotent: already deleted
        setResources((current) =>
          current.filter((resource) => resource.id !== deleteId),
        );
      } else {
        console.error(requestError);
        setError("Không thể xóa ngữ liệu.");
      }
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary-600">
            Resource library
          </p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">
            Kho ngữ liệu
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Lưu trữ hình ảnh, PDF và văn bản dùng cho câu hỏi.
          </p>
        </div>
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.md"
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            isLoading={isUploading}
          >
            + Tải ngữ liệu
          </Button>
        </>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm text-danger-500"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(["IMAGE", "PDF", "TEXT"] as const).map((type) => (
          <div
            key={type}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-neutral-500">{typeLabel[type]}</p>
            <p className="mt-2 text-3xl font-bold text-neutral-900">
              {resources.filter((resource) => resource.type === type).length}
            </p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-neutral-200 bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
        </div>
      ) : resources.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <p className="text-lg font-semibold text-neutral-800">
            Kho ngữ liệu đang trống
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Tải lên hình ảnh, PDF hoặc file văn bản đầu tiên.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => {
            const url = `${API_URL}${resource.content_url}`;
            return (
              <article
                key={resource.id}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-36 items-center justify-center bg-neutral-50">
                  {resource.type === "IMAGE" ? (
                    <img
                      src={url}
                      alt={resource.original_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl">
                      {resource.type === "PDF" ? "PDF" : "TXT"}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2
                        className="truncate text-sm font-semibold text-neutral-900"
                        title={resource.original_name}
                      >
                        {resource.original_name}
                      </h2>
                      <p className="mt-1 text-xs text-neutral-500">
                        {typeLabel[resource.type]} ·{" "}
                        {formatSize(resource.size_bytes)}
                      </p>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-600">
                      #{resource.id}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      Mở file
                    </a>
                    <button
                      type="button"
                      onClick={() => setDeleteId(resource.id)}
                      className="text-sm font-medium text-danger-500 hover:text-danger-700"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Xóa ngữ liệu"
        message={
          <p>
            File sẽ bị xóa khỏi kho lưu trữ. Hành động này không thể hoàn tác.
          </p>
        }
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
