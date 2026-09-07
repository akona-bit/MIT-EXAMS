import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDgnlBlueprint,
  createMatrixFromDgnlBlueprint,
  type DgnlBlueprint,
  type DgnlBlueprintSlot,
} from "../../../api/matrix";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Modal from "../../ui/Modal";
import { toast } from "../../ui/Toast";
import {
  Lock,
  FileText,
  Blocks,
  Loader2,
  CheckCircle2,
  Clock,
  Target,
} from "lucide-react";

interface DgnlBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Màu theo phần — đồng bộ design token (emerald/sky/indigo/rose)
const PART_STYLES: Record<number, { bar: string; chip: string; ring: string }> = {
  1: { bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", ring: "ring-emerald-200" },
  2: { bar: "bg-sky-500", chip: "bg-sky-50 text-sky-700 border-sky-200", ring: "ring-sky-200" },
  3: { bar: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-700 border-indigo-200", ring: "ring-indigo-200" },
  4: { bar: "bg-rose-500", chip: "bg-rose-50 text-rose-700 border-rose-200", ring: "ring-rose-200" },
};

export default function DgnlBlueprintModal({ isOpen, onClose }: DgnlBlueprintModalProps) {
  const navigate = useNavigate();
  const [blueprint, setBlueprint] = useState<DgnlBlueprint | null>(null);
  const [structureErrors, setStructureErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("Ma trận ĐGNL ĐHQG-HCM chuẩn 120 câu");
  const [description, setDescription] = useState(
    "Sinh tự động từ blueprint khung xương chuẩn (đối chiếu 3 nguồn: đề mẫu ĐHQG + 2 đề phục dựng).",
  );

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

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.warning("Vui lòng nhập tên ma trận.");
      return;
    }
    setIsCreating(true);
    try {
      const res = await createMatrixFromDgnlBlueprint({ name: name.trim(), description: description.trim() || undefined });
      if (res.unmatched?.length > 0) {
        toast.warning(
          `Đã tạo ma trận với ${res.matched.length}/39 ô khớp kiến thức. ${res.unmatched.length} ô chưa có node tương ứng — hãy bổ sung trong trang chi tiết.`,
        );
      } else {
        toast.success(`Đã tạo ma trận ĐGNL chuẩn — khớp đủ ${res.matched.length}/39 ô kiến thức.`);
      }
      onClose();
      navigate(`/admin/matrix/${res.id}`);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.detail?.message || "Lỗi khi tạo ma trận từ blueprint.");
    } finally {
      setIsCreating(false);
    }
  };

  const renderSlotBar = (slot: DgnlBlueprintSlot, part: number) => {
    const style = PART_STYLES[part];
    const widthPct = (slot.count / 30) * 100;
    return (
      <div
        key={slot.key}
        title={`${slot.label} (${slot.count} câu)${slot.note ? " — " + slot.note : ""}`}
        className={`relative group flex flex-col justify-center rounded-lg ${style.bar} text-white shadow-sm overflow-hidden cursor-default`}
        style={{ width: `${widthPct}%`, minWidth: "34px" }}
      >
        <span className="text-[11px] font-bold text-center leading-none">{slot.count}</span>
        <span className="absolute inset-0 flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 bg-slate-900/60 transition-opacity p-1">
          {slot.passage && <FileText className="w-3 h-3 shrink-0" />}
          {slot.order_locked && <Lock className="w-3 h-3 shrink-0" />}
        </span>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Blueprint ĐGNL ĐHQG-HCM — 120 câu chuẩn" maxWidth="max-w-4xl">
      <div className="p-6 space-y-5 overflow-y-auto">
        {/* Info banner */}
        <div className="rounded-xl bg-primary-50 dark:bg-primary-900/20 p-4 border border-primary-100 dark:border-primary-800/50 flex gap-3 items-start">
          <div className="p-2 bg-primary-600 text-white rounded-lg shrink-0">
            <Blocks className="w-5 h-5" />
          </div>
          <div className="text-sm text-primary-900 dark:text-primary-200 leading-relaxed">
            <p className="font-bold mb-1">Khung xương bất biến đã đối chiếu chéo 3 nguồn</p>
            <p>
              4 phần × 30 câu · khối chung dữ kiện {blueprint ? "12+5+5 (TV) và 7+8 (TA)" : ""} · trình tự 6 lĩnh vực
              Tư duy khoa học <span className="font-semibold">Hóa → Lý → Sinh → XH/KT → Sử → Ứng dụng</span> (cứng).
              Toán: 9 khối 2 câu + 4 khối 3 câu (2 khối đầu cứng).
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : blueprint ? (
          <>
            {/* Summary chips */}
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <Target className="w-3.5 h-3.5 text-primary-500" /> {blueprint.total_questions} câu · {blueprint.total_slots} ô ma trận
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <Clock className="w-3.5 h-3.5 text-primary-500" /> {blueprint.duration_minutes} phút · {blueprint.score_scale}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <FileText className="w-3.5 h-3.5 text-primary-500" /> Khối chung ngữ liệu: liền kề bắt buộc
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <Lock className="w-3.5 h-3.5 text-primary-500" /> Trình tự cứng ({blueprint.parts.reduce((acc, p) => acc + p.slots.filter((s) => s.order_locked).length, 0)} ô)
              </span>
            </div>

            {/* Part skeletons */}
            <div className="space-y-4">
              {blueprint.parts.map((part) => {
                const style = PART_STYLES[part.part];
                return (
                  <div key={part.part} className={`rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-white/60 dark:bg-slate-900/60 ring-1 ring-inset ${style.ring}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${style.bar}`} />
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                          Phần {part.part}: {part.name}
                        </h4>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${style.chip}`}>
                        Câu {part.question_range} · {part.total} câu
                      </span>
                    </div>
                    {/* Block bar */}
                    <div className="flex gap-1 h-10 items-stretch">
                      {part.slots.map((slot) => renderSlotBar(slot, part.part))}
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {part.slots.map((slot) => (
                        <span key={slot.key} className="inline-flex items-center gap-1">
                          <span className={`inline-block w-2 h-2 rounded-sm ${style.bar}`} />
                          <span className="font-medium text-slate-600 dark:text-slate-300">{slot.count}p</span> {slot.label}
                          {slot.passage && <FileText className="w-3 h-3 inline" />}
                          {slot.order_locked && <Lock className="w-3 h-3 inline" />}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Create form */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Tên ma trận" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
                <Input label="Mô tả" value={description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Hệ thống sẽ tạo <strong>39 ô ma trận</strong> (rule đơn giản — engine tự cân bằng dạng câu/mức độ) +{" "}
                <strong>5 nhóm chung ngữ liệu</strong>. Ô nào chưa có node kiến thức tương ứng sẽ được báo để bạn bổ sung.
                Các ô đọc hiểu cần gắn Passage cụ thể sau khi tạo.
              </p>
            </div>
          </>
        ) : null}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={isCreating}>
            Hủy bỏ
          </Button>
          <Button
            onClick={handleCreate}
            isLoading={isCreating}
            disabled={isLoading || !blueprint || structureErrors.length > 0}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold shadow-lg shadow-primary-500/30 px-6 rounded-xl"
          >
            {!isCreating && <CheckCircle2 className="w-4 h-4 mr-2" />}
            {isCreating ? "Đang tạo ma trận..." : "Tạo ma trận từ blueprint"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

