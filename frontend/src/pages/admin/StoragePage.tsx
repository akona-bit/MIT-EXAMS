import { useState, useEffect, useCallback } from "react";
import { getStorageStats, deleteStorageObject, type StorageStats } from "../../api/admin";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { toast } from "../../components/ui/Toast";
import { Database, HardDrive, Users, RefreshCw, Trash2, FileImage } from "lucide-react";

function formatBytes(bytes: number): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const BUCKET_LABELS: Record<string, string> = {
  "van-ban": "Học liệu — Văn bản",
  "hinh-anh": "Học liệu — Hình ảnh",
  "bang-bieu": "Học liệu — Bảng biểu",
  "viet-tay": "Học liệu — Viết tay",
  pdf: "Học liệu — PDF",
  "omr-sheets": "Phiếu OMR đã quét",
  "exam-pdfs": "Đề thi PDF",
  resources: "Resources (cũ)",
  verifications: "Ảnh xác thực thí sinh",
};

function UsageBar({ pct, tone = "primary" }: { pct: number; tone?: "primary" | "warning" | "danger" }) {
  const color = tone === "danger" ? "bg-red-500" : tone === "warning" ? "bg-amber-500" : "bg-primary-500";
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export default function StoragePage() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ bucket: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getStorageStats();
      setStats(data);
    } catch {
      toast.error("Không tải được thống kê dung lượng.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteStorageObject(deleteTarget.bucket, deleteTarget.name);
      toast.success(`Đã xoá ${deleteTarget.name}`);
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("Xoá file thất bại.");
    } finally {
      setIsDeleting(false);
    }
  };

  const dbTone = stats && stats.database.usage_pct >= 90 ? "danger" : stats && stats.database.usage_pct >= 70 ? "warning" : "primary";
  const stTone = stats && stats.storage.usage_pct >= 90 ? "danger" : stats && stats.storage.usage_pct >= 70 ? "warning" : "primary";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dữ liệu &amp; Bộ nhớ (Supabase)</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Dung lượng database và storage đang sử dụng — kiểm tra và dọn dẹp
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} isLoading={isLoading}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Làm mới
        </Button>
      </div>

      {isLoading && !stats ? (
        <div className="py-20 text-center text-slate-500">Đang tải thống kê...</div>
      ) : stats ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-500" />
                    Database
                  </CardTitle>
                  <span className="text-xs text-slate-400">{stats.database.usage_pct.toFixed(1)}% quota</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatBytes(stats.database.total_bytes)}</p>
                <p className="text-xs text-slate-400 mb-2">trên {formatBytes(stats.database.quota_bytes)} (Free plan)</p>
                <UsageBar pct={stats.database.usage_pct} tone={dbTone as "primary" | "warning" | "danger"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-violet-500" />
                    Storage (file)
                  </CardTitle>
                  <span className="text-xs text-slate-400">{stats.storage.usage_pct.toFixed(1)}% quota</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatBytes(stats.storage.total_bytes)}</p>
                <p className="text-xs text-slate-400 mb-2">
                  {stats.storage.total_files} file trên {formatBytes(stats.storage.quota_bytes)}
                </p>
                <UsageBar pct={stats.storage.usage_pct} tone={stTone as "primary" | "warning" | "danger"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-500" />
                  Supabase Auth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.auth_users ?? "—"}</p>
                <p className="text-xs text-slate-400">tài khoản trong auth.users</p>
              </CardContent>
            </Card>
          </div>

          {/* Buckets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="h-4 w-4 text-primary-500" />
                Dung lượng theo bucket
              </CardTitle>
              <CardDescription>File nằm trong Supabase Storage — nguồn chiếm dụng chính</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Bucket</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-500">Kiểu</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-500">Số file</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">Dung lượng</th>
                      <th className="px-3 py-2 font-semibold text-slate-500 w-48">Tỷ trọng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stats.storage.buckets.map((b) => (
                      <tr key={b.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">
                          {BUCKET_LABELS[b.name] ?? b.name}
                          <span className="ml-2 text-xs font-mono text-slate-400">{b.name}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            b.public ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}>
                            {b.public ? "Public" : "Private"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-slate-600 dark:text-slate-300">{b.file_count}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          {formatBytes(b.total_size)}
                        </td>
                        <td className="px-3 py-2">
                          <UsageBar
                            pct={stats.storage.total_bytes > 0 ? (b.total_size / stats.storage.total_bytes) * 100 : 0}
                          />
                        </td>
                      </tr>
                    ))}
                    {stats.storage.buckets.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Chưa có file nào trong Storage.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>


          {/* DB tables */}
          <Card>
            <CardHeader>
              <CardTitle>Bảng database lớn nhất</CardTitle>
              <CardDescription>Tổng size (bảng + index) trong schema public — để phát hiện bảng phình to</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Bảng</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">Số dòng (ước tính)</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">Dung lượng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stats.database.tables.slice(0, 20).map((t) => (
                      <tr key={t.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">{t.name}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500">{t.row_estimate.toLocaleString("vi-VN")}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          {formatBytes(t.total_size)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Top objects */}
          <Card>
            <CardHeader>
              <CardTitle>File lớn nhất trong Storage (Top 30)</CardTitle>
              <CardDescription>Kiểm tra và xoá file không cần thiết để giải phóng dung lượng</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Bucket</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Tên file</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">Dung lượng</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">Ngày tạo</th>
                      <th className="px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stats.storage.top_objects.map((o) => (
                      <tr key={`${o.bucket}/${o.name}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-xs font-mono">
                            {o.bucket}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300 max-w-xs truncate" title={o.name}>
                          {o.name}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          {formatBytes(o.size)}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500 text-xs">
                          {new Date(o.created_at).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => setDeleteTarget({ bucket: o.bucket, name: o.name })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                            title="Xoá file"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {stats.storage.top_objects.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Không có file nào.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Xoá file khỏi Supabase Storage?"
        message={`File "${deleteTarget?.name}" trong bucket "${deleteTarget?.bucket}" sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác và sẽ được ghi vào audit log.`}
        isDestructive
        isLoading={isDeleting}
        confirmText="Xoá vĩnh viễn"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

