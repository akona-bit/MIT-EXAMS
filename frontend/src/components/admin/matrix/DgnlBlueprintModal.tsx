import { useEffect, useState } from "react";
import {
  getDgnlBlueprint,
  getDgnlBlueprintTemplate,
  type DgnlBlueprint,
  type DgnlBlueprintSlot,
} from "../../../api/matrix";
import Button from "../../ui/Button";
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
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";

interface DgnlBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: { rules: any[]; groups: any[] }) => void;
}

// Màu theo phần — đồng bộ design token (emerald/sky/indigo/rose)
const PART_STYLES: Record<number, { bar: string; chip: string; ring: string }> = {
  1: { bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", ring: "ring-emerald-200" },
  2: { bar: "bg-sky-500", chip: "bg-sky-50 text-sky-700 border-sky-200", ring: "ring-sky-200" },
  3: { bar: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-700 border-indigo-200", ring: "ring-indigo-200" },
  4: { bar: "bg-rose-500", chip: "bg-rose-50 text-rose-700 border-rose-200", ring: "ring-rose-200" },
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

  const renderSlotBar = (slot: DgnlBlueprintSlot, part: number) => {
    const style = PART_STYLES[part];
    const widthPct = (slot.count / 30) * 100;
    return (
      <div
        key={slot.key}
        title={`${slot.label} (${slot.count} câu)${slot.note ? " — " + slot.note : ""}`}
        className={`relative group flex flex-col justify-center rounded-lg ${style.bar} text-white shadow-sm overflow-hidden cursor-default transition-all duration-300 hover:scale-105 hover:z-10`}
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
    <Modal isOpen={isOpen} onClose={onClose} title="Template Blueprint ĐGNL ĐHQG-HCM" maxWidth="max-w-4xl">
      <div className="p-6 space-y-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/30">
        {/* Info banner */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-900/10 p-5 border border-primary-200/50 dark:border-primary-800/50 flex gap-4 items-start shadow-sm"
        >
          <div className="p-2.5 bg-white dark:bg-slate-800 text-primary-600 rounded-xl shrink-0 shadow-sm border border-primary-100 dark:border-primary-800">
            <Blocks className="w-6 h-6" />
          </div>
          <div className="text-sm text-primary-950 dark:text-primary-100 leading-relaxed">
            <p className="font-bold text-base mb-1.5 flex items-center gap-2">
              Bản mẫu linh hoạt (Template Mode)
              <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">Mới</span>
            </p>
            <p className="text-primary-800 dark:text-primary-200/80">
              Thay vì tạo ngay ma trận cứng nhắc, bạn có thể áp dụng bản mẫu này vào Form. 
              Mẫu bao gồm <strong>39 ô kiến thức chuẩn</strong> (đối chiếu 3 nguồn: đề mẫu ĐHQG + 2 đề phục dựng). 
              Sau khi áp dụng, bạn <strong>hoàn toàn có thể sửa đổi</strong> số lượng câu, xóa bớt phần thi, hoặc thay đổi chủ đề trước khi lưu.
            </p>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : blueprint ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Summary chips */}
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm text-slate-700 dark:text-slate-200">
                <Target className="w-4 h-4 text-primary-500" /> {blueprint.total_questions} câu mặc định
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm text-slate-700 dark:text-slate-200">
                <Clock className="w-4 h-4 text-primary-500" /> {blueprint.duration_minutes} phút
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm text-slate-700 dark:text-slate-200">
                <FileText className="w-4 h-4 text-primary-500" /> Nhóm ngữ liệu tự động
              </span>
            </div>

            {/* Part skeletons */}
            <div className="grid grid-cols-1 gap-4">
              {blueprint.parts.map((part, index) => {
                const style = PART_STYLES[part.part];
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + index * 0.05 }}
                    key={part.part} 
                    className={`rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 bg-white dark:bg-slate-800/80 ring-1 ring-inset ${style.ring} shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-3 h-3 rounded-full ${style.bar} shadow-sm`} />
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base">
                          Phần {part.part}: {part.name}
                        </h4>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${style.chip}`}>
                        {part.total} câu
                      </span>
                    </div>
                    {/* Block bar */}
                    <div className="flex gap-1.5 h-12 items-stretch">
                      {part.slots.map((slot) => renderSlotBar(slot, part.part))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : null}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={isApplying} className="rounded-xl px-5">
            Đóng
          </Button>
          <Button
            onClick={handleApply}
            isLoading={isApplying}
            disabled={isLoading || !blueprint || structureErrors.length > 0}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold shadow-lg shadow-primary-500/30 px-6 rounded-xl group"
          >
            {!isApplying && <CheckCircle2 className="w-4 h-4 mr-2" />}
            {isApplying ? "Đang xử lý..." : "Sử dụng mẫu này"}
            {!isApplying && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
