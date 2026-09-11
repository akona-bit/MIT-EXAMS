import { useState, useRef } from "react";
import { UploadCloud, X, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import Button from "../ui/Button";
import { supabase } from "../../lib/supabase";
import api from "../../api/client";
import { useAuth } from "../../stores/authStore";

interface VerificationUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: number;
  onSuccess: () => void;
}

export default function VerificationUploadModal({
  isOpen,
  onClose,
  examId,
  onSuccess,
}: VerificationUploadModalProps) {
  const { user, fetchUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setError("Vui lòng chọn file hình ảnh.");
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setError("Dung lượng ảnh tối đa là 5MB.");
      return;
    }

    setFile(selected);
    setError(null);
    const objectUrl = URL.createObjectURL(selected);
    setPreview(objectUrl);
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setIsUploading(true);
    setError(null);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("verifications")
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("verifications")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update user verification
      await api.patch("/api/v1/users/me", {
        verification_image_url: publicUrl,
      });

      // Refresh local user state
      await fetchUser();

      // Finalize the exam submission
      await api.post(`/api/v1/exams/${examId}/finalize-submission`);
      
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Có lỗi xảy ra khi tải ảnh lên.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Chứng thực học sinh
            </h2>
          </div>
          {!isUploading && (
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-sm text-rose-800 dark:text-rose-300">
              <p className="font-bold mb-1">Cảnh báo quan trọng!</p>
              <p>
                Tuyệt đối không tải lên ảnh Căn cước công dân (CCCD) hoặc các giấy tờ tùy thân nhạy cảm khác. Vui lòng chỉ tải ảnh chụp Thẻ học sinh, Phù hiệu hoặc Giấy báo dự thi hợp lệ.
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Để hoàn tất việc nộp bài, bạn cần tải lên ảnh minh chứng. Bài thi của bạn sẽ ở trạng thái "Chưa nộp" cho đến khi bạn hoàn thành bước này.
          </p>

          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
              preview
                ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                : "border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10 hover:bg-primary-50 dark:hover:bg-primary-900/20"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            {preview ? (
              <div className="flex flex-col items-center">
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-48 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 mb-4"
                />
                <Button variant="outline" size="sm" type="button" onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}>
                  Chọn ảnh khác
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center pointer-events-none">
                <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/40 text-primary-600 rounded-full flex items-center justify-center mb-4">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <p className="font-semibold text-slate-900 dark:text-white mb-1">
                  Nhấn để chọn ảnh
                </p>
                <p className="text-xs text-slate-500">
                  Hỗ trợ JPG, PNG (tối đa 5MB)
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500 mt-3 font-medium text-center">
              {error}
            </p>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Để sau
          </Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang tải lên...
              </>
            ) : (
              "Hoàn tất nộp bài"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
