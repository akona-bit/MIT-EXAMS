import { useState } from "react";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { previewMatrixImport, executeMatrixImport } from "../../api/matrix";
import { CheckCircle2, ArrowRight, ArrowLeft, FileUp } from "lucide-react";

interface MatrixImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  matrixId: number;
  onSuccess: () => void;
}

interface PreviewRow {
  topic: string;
  concept: string;
  skill: string;
  original_count: number;
  status: string;
  node_id: number | null;
  suggestions: { id: number; name: string }[];
  distributed_rules: { level: number; question_type: string; count: number }[];
}

export default function MatrixImportModal({ isOpen, onClose, matrixId, onSuccess }: MatrixImportModalProps) {
  const [step, setStep] = useState<'config' | 'input' | 'preview'>('config');
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Configuration
  const [levelRatios, setLevelRatios] = useState<Record<number, number>>({ 1: 0.2, 2: 0.3, 3: 0.3, 4: 0.2 });
  const [typeRatios, setTypeRatios] = useState<Record<string, number>>({ "SINGLE_CHOICE": 1.0 });

  // Step 2: Input
  const [content, setContent] = useState("");

  // Step 3: Preview
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [strategy, setStrategy] = useState<'add' | 'replace'>('add');

  const handleNextConfig = () => {
    setStep('input');
  };

  const handleNextInput = async () => {
    if (!content.trim()) {
      alert("Vui lòng nhập dữ liệu bảng");
      return;
    }

    setIsLoading(true);
    try {
      const res = await previewMatrixImport(matrixId, {
        content,
        level_ratios: levelRatios,
        type_ratios: typeRatios
      });
      setPreviewRows(res.preview);
      setStep('preview');
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra khi xem trước dữ liệu");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveNode = async (index: number, nodeId: number) => {
    const newRows = [...previewRows];
    newRows[index].node_id = nodeId;
    newRows[index].status = "✅ Khớp chính xác";
    setPreviewRows(newRows);
  };

  const handleConfirmImport = async () => {
    const unresolved = previewRows.some(r => r.status !== "✅ Khớp chính xác");
    if (unresolved) {
      alert("Vui lòng xử lý tất cả các dòng chưa khớp trước khi nhập");
      return;
    }

    setIsLoading(true);
    try {
      await executeMatrixImport(matrixId, {
        confirmed_rows: previewRows,
        strategy: strategy
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra khi nhập dữ liệu");
    } finally {
      setIsLoading(false);
    }
  };

  const stepTitles: Record<string, string> = {
    config: "Cấu hình tỷ lệ",
    input: "Nhập dữ liệu",
    preview: "Xác nhận dữ liệu",
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={stepTitles[step]}
    >
      <div className="p-6 space-y-6">
        {step === 'config' && (
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Thiết lập tỷ lệ phân bổ câu hỏi cho toàn bộ bảng nhập. Hệ thống sẽ tự động làm tròn để khớp với số lượng gốc.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Tỷ lệ Mức độ (%)
                </h4>
                {[
                  { id: 1, label: "Nhận biết" },
                  { id: 2, label: "Thông hiểu" },
                  { id: 3, label: "Vận dụng" },
                  { id: 4, label: "Vận dụng cao" },
                ].map(lvl => (
                  <div key={lvl.id} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-24 text-slate-500">{lvl.label}</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                      value={levelRatios[lvl.id] * 100}
                      onChange={e => setLevelRatios({...levelRatios, [lvl.id]: parseFloat(e.target.value) / 100})}
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Tỷ lệ Dạng câu (%)
                </h4>
                {Object.entries(typeRatios).map(([type, val]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-24 text-slate-500">{type === 'SINGLE_CHOICE' ? 'Trắc nghiệm' : type}</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                      value={val * 100}
                      onChange={e => setTypeRatios({...typeRatios, [type]: parseFloat(e.target.value) / 100})}
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={handleNextConfig} size="lg">Tiếp tục <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {step === 'input' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <FileUp className="w-4 h-4" />
              <span>Hãy copy dữ liệu từ Excel (cột Topic, Concept, Kiến thức, Số lượng) và dán vào đây.</span>
            </div>
            <textarea
              rows={12}
              className="w-full p-4 text-sm font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-4 focus:ring-primary-500/20"
              placeholder="Topic\tConcept\tKiến thức\tSố lượng"
              value={content}
              onChange={e => setContent(e.target.value)}
            />
            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep('config')}><ArrowLeft className="w-4 h-4 mr-1" /> Quay lại</Button>
              <Button onClick={handleNextInput} isLoading={isLoading} size="lg">Xem trước kết quả <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">✅</span> Khớp
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">⚠️</span> Gợi ý
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">❌</span> Lỗi
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Xử lý trùng:</span>
                <select
                  className="text-xs p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded outline-none"
                  value={strategy}
                  onChange={e => setStrategy(e.target.value as any)}
                >
                  <option value="add">Cộng dồn</option>
                  <option value="replace">Thay thế</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-white/10 rounded-xl max-h-[400px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Kiến thức</th>
                    <th className="px-4 py-2 font-semibold">SL</th>
                    <th className="px-4 py-2 font-semibold">Trạng thái</th>
                    <th className="px-4 py-2 font-semibold">Xử lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2">
                        <div className="font-medium">{row.skill}</div>
                        <div className="text-[10px] text-slate-400">{row.topic} &gt; {row.concept}</div>
                      </td>
                      <td className="px-4 py-2 font-bold">{row.original_count}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.status.startsWith('✅') ? 'bg-green-100 text-green-700' :
                          row.status.startsWith('⚠️') ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {row.status === "✅ Khớp chính xác" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <select
                            className="text-xs p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded outline-none"
                            value={row.node_id || ""}
                            onChange={e => handleResolveNode(idx, Number(e.target.value))}
                          >
                            <option value="">-- Chọn node --</option>
                            {row.suggestions.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep('input')}><ArrowLeft className="w-4 h-4 mr-1" /> Quay lại</Button>
              <Button
                onClick={handleConfirmImport}
                isLoading={isLoading}
                size="lg"
                disabled={previewRows.some(r => r.status !== "✅ Khớp chính xác")}
              >
                Xác nhận nhập dữ liệu
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
