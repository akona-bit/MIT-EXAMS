import { useEffect, useState } from "react";
import {
  getDgnlBlueprint,
  getDgnlBlueprintTemplate,
  type DgnlBlueprint,
  type DgnlBlueprintSlot,
} from "../../../api/matrix";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import Alert from "../../ui/Alert";
import { toast } from "../../ui/Toast";
import {
  Lock,
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  Target,
  ArrowRight,
  Shuffle,
} from "lucide-react";

interface DgnlBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: { rules: any[]; groups: any[] }) => void;
}

// Màu 4 phần thi — đồng nhất theo ui-tokens.md (chuẩn biểu đồ/thống kê toàn hệ thống):
// Tiếng Việt = primary (xanh dương) · Tiếng Anh = danger (đỏ)
// Toán học = warning (cam) · Tư duy khoa học = success (xanh lá)
const PART_STYLES: Record<number, { text: string; bg: string; border: string; bar: string }> = {
  1: {
    text: "text-primary-600 dark:text-primary-400",
    bg: "bg-primary-500/5 dark:bg-primary-500/10",
    border: "border-primary-500/20",
    bar: "bg-primary-500",
  },
  2: {
    text: "text-danger-600 dark:text-danger-400",
    bg: "bg-danger-500/5 dark:bg-danger-500/10",
    border: "border-danger-500/20",
    bar: "bg-danger-500",
  },
  3: {
    text: "text-warning-600 dark:text-warning-500",
    bg: "bg-warning-500/5 dark:bg-warning-500/10",
    border: "border-warning-500/20",
    bar: "bg-warning-500",
  },
  4: {
    text: "text-success-600 dark:text-success-500",
    bg: "bg-success-500/5 dark:bg-success-500/10",
    border: "border-success-500/20",
    bar: "bg-success-500",
  },
};

export default function DgnlBlueprintModal({ isOpen, onClose, onApply }: DgnlBlueprintModalProps) {
  const [blueprint, setBlueprint] = useState<DgnlBlueprint | null>(null);
  const [structureErrors, setStructureErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getDgnlBlueprint()
        .then((res) => {
          setBlueprint(res.blueprint);
          setStructureErrors(res.structure_errors);
        })
        .catch(() => toast.error("Không tải được blueprint ĐGNL."))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const template = await getDgnlBlueprintTemplate();
      const matched = template.rules.filter((r) => r.knowledge_node_id);
      
      if (matched.length < template.rules.length) {
        toast.warning(
          `Đã áp dụng mẫu với ${matched.length}/${template.rules.length} ô khớp kiến thức. Số còn lại hãy chọn thủ công trong bảng.`
        );
      } else {
        toast.success(`Đã áp dụng mẫu ĐGNL chuẩn — khớp đủ ${matched.length}/${template.rules.length} ô kiến thức.`);
      }
      onApply(template);
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error("Lỗi khi tải dữ liệu mẫu blueprint.");
    } finally {
      setIsApplying(false);
    }
  };

  const renderSlotTile = (slot: DgnlBlueprintSlot, part: number) => {
    const style = PART_STYLES[part];
    return (
      <div
        key={slot.key}
        className="group relative flex flex-col gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 transition-all hover:shadow-md hover:-translate-y-0.5"
      >
        {/* Icon ràng buộc (góc phải trên) */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
          {slot.passage && (
            <span
              title="Ô dùng chung ngữ liệu đọc hiểu"
              className="inline-flex items-center rounded-md bg-warning-500/10 px-1.5 py-1"
            >
              <FileText className="w-3 h-3 text-warning-600 dark:text-warning-500" />
            </span>
          )}
          {slot.order_locked && (
            <span
              title="Vị trí cố định trong đề"
              className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-1"
            >
              <Lock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
            </span>
          )}
          {slot.shuffle_group && (
            <span
              title={`Hoán đổi vị trí trong nhóm ${slot.shuffle_group}`}
              className="inline-flex items-center rounded-md bg-info-500/10 px-1.5 py-1"
            >
              <Shuffle className="w-3 h-3 text-info-600 dark:text-info-500" />
            </span>
          )}
        </div>

        {/* Số câu — số to, màu theo phần thi */}
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-black leading-none tracking-tight ${style.text}`}>
            {slot.count}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            câu
          </span>
        </div>

        {/* Tên ô kiến thức */}
        <p className="text-xs font-medium leading-snug text-slate-600 dark:text-slate-300 line-clamp-2 pr-2">
          {slot.label}
        </p>

        {/* Ghi chú — tooltip khi hover */}
        {slot.note && (
          <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-52 -translate-x-1/2 group-hover:block">
            <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] leading-snug text-white shadow-lg">
              <p className="mb-0.5 font-semibold">{slot.label}</p>
              <p className="text-slate-300">{slot.note}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mẫu ma trận ĐGNL ĐHQG-HCM" maxWidth="max-w-5xl">
      <div className="p-5 sm:p-6 space-y-6">

        {/* Info banner — dùng component Alert chuẩn của hệ thống */}
        <Alert variant="info" title="Bản mẫu ĐGNL chuẩn (39 ô kiến thức)">
          Mỗi ô hiển thị <strong>số câu</strong> và các ràng buộc kèm theo. Bạn có thể áp dụng ngay
          để tự động xây khung sườn ma trận, sau đó chỉnh sửa tự do số lượng câu hoặc đổi chủ đề
          trực tiếp trên lưới.
        </Alert>

        {/* Cảnh báo cấu trúc (nếu có) — theo ui-rules: cảnh báo nổi bật, không chôn trong bảng */}
        {structureErrors.length > 0 && (
          <Alert variant="warning" title="Mẫu chưa khớp hoàn toàn với ngân hàng câu hỏi">
            <ul className="list-disc list-inside space-y-1">
              {structureErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <p className="text-sm text-slate-500">Đang phân tích cấu trúc...</p>
          </div>
        ) : blueprint ? (
          <div className="space-y-6">
            {/* Summary chips — nền đặc, viền rõ */}
            <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <Target className="w-4 h-4 text-primary-500" />
                <span className="font-bold text-slate-900 dark:text-slate-100">{blueprint.total_questions}</span> câu mặc định
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <Clock className="w-4 h-4 text-primary-500" />
                <span className="font-bold text-slate-900 dark:text-slate-100">{blueprint.duration_minutes}</span> phút
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <FileText className="w-4 h-4 text-primary-500" />
                Gộp nhóm ngữ liệu tự động
              </span>
            </div>

            {/* Part visual — thanh tỉ lệ trọng số + lưới ô kiến thức */}
            <div className="grid grid-cols-1 gap-5">
              {blueprint.parts.map((part) => {
                const style = PART_STYLES[part.part];
                return (
                  <div
                    key={part.part}
                    className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden border-l-4 ${style.bar.replace("bg-", "border-l-")}`}
                  >
                    {/* Part Header */}
                    <div className={`flex items-center justify-between p-4 ${style.bg}`}>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-9 h-9 rounded-xl shadow-sm font-black text-base ${style.bar} text-white`}>
                          {part.part}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight">
                            {part.name}
                          </h4>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Câu {part.question_range}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-black leading-none ${style.text}`}>{part.total}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">câu</p>
                      </div>
                    </div>

                    <div className="p-4 pt-3 space-y-3">
                      {/* Thanh tỉ lệ trọng số: độ rộng segment ∝ số câu */}
                      <div className="flex h-2.5 gap-0.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                        {part.slots.map((slot) => (
                          <div
                            key={slot.key}
                            className={`${style.bar} first:rounded-l-full last:rounded-r-full transition-opacity hover:opacity-80`}
                            style={{ flexGrow: slot.count, flexBasis: 0 }}
                            title={`${slot.label}: ${slot.count} câu`}
                          />
                        ))}
                      </div>

                      {/* Lưới ô kiến thức */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                        {part.slots.map((slot) => renderSlotTile(slot, part.part))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Actions — sticky footer, dùng Button mặc định của hệ thống */}
        <div className="sticky bottom-0 -m-5 sm:-m-6 mt-6 p-5 sm:p-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 z-20 rounded-b-2xl">
          <div className="hidden md:flex items-center gap-4 text-[11px] font-medium text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-warning-500" />
              Chung ngữ liệu
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Cố định vị trí
            </span>
            <span className="flex items-center gap-1.5">
              <Shuffle className="w-3.5 h-3.5 text-info-500" />
              Nhóm hoán đổi
            </span>
          </div>
          <div className="flex justify-end gap-3 ml-auto">
            <Button variant="ghost" onClick={onClose} disabled={isApplying} className="px-4">
              Đóng
            </Button>
            <Button
              onClick={handleApply}
              isLoading={isApplying}
              disabled={isLoading || !blueprint || structureErrors.length > 0}
              className="px-6"
            >
              {!isApplying && <CheckCircle2 className="w-4 h-4 mr-2" />}
              {isApplying ? "Đang xử lý..." : "Sử dụng mẫu này"}
              {!isApplying && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
