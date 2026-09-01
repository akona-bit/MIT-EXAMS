import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getKnowledgeTree } from "../../api/knowledge";
import { getSmartLeaves, proposeSmartDistribution, confirmSmartMatrix } from "../../api/matrix";
import type { KnowledgeNode } from "../../types";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Modal from "../ui/Modal";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2, FileText } from "lucide-react";

interface SmartMatrixWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LeafNode {
  node_id: number;
  name: string;
  node_type: string;
  path: string;
  question_count: number;
  topic_name?: string;
  concept_name?: string;
}

interface SkillAllocation {
  node_id: number;
  name: string;
  path: string;
  question_count: number;
  proposed_count: number;
  percentage: number;
  has_warning: boolean;
}

type Step = "scope" | "propose" | "confirm";

export default function SmartMatrixWizard({ isOpen, onClose }: SmartMatrixWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("scope");
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Scope
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<number>>(new Set());
  const [leaves, setLeaves] = useState<LeafNode[]>([]);

  // Step 2: Propose
  const [totalQuestions, setTotalQuestions] = useState(120);
  const [allocations, setAllocations] = useState<SkillAllocation[]>([]);
  const [totalInBank, setTotalInBank] = useState(0);

  // Step 3: Confirm
  const [matrixName, setMatrixName] = useState("");
  const [matrixDescription, setMatrixDescription] = useState("");
  const [levelRatios, setLevelRatios] = useState<Record<number, number>>({ 1: 0.2, 2: 0.3, 3: 0.3, 4: 0.2 });

  useEffect(() => {
    if (isOpen) {
      getKnowledgeTree().then(setNodes).catch(console.error);
      setStep("scope");
      setSelectedNodeIds(new Set());
      setLeaves([]);
      setAllocations([]);
      setMatrixName("");
      setMatrixDescription("");
    }
  }, [isOpen]);

  const toggleNode = (id: number) => {
    const next = new Set(selectedNodeIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedNodeIds(next);
  };

  const selectAllTopics = () => {
    const topicIds = nodes.filter((n) => n.level === "TOPIC").map((n) => n.id);
    setSelectedNodeIds(new Set(topicIds));
  };

  // Step 1 → 2: Fetch leaves
  const handleScopeNext = async () => {
    if (selectedNodeIds.size === 0) return;
    setIsLoading(true);
    try {
      const res = await getSmartLeaves(Array.from(selectedNodeIds));
      setLeaves(res.leaves);
      setTotalInBank(res.total_questions_in_bank);
      setStep("propose");
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra khi tải danh sách skill lá");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 → 3: Compute proposals
  const handleProposeNext = async () => {
    if (totalQuestions <= 0) return;
    setIsLoading(true);
    try {
      const res = await proposeSmartDistribution({
        node_ids: Array.from(selectedNodeIds),
        total_questions: totalQuestions,
        level_ratios: levelRatios,
        type_ratios: { SINGLE_CHOICE: 1.0 },
      });
      setAllocations(res.skills);
      setStep("confirm");
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra khi đề xuất phân bổ");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Confirm and create
  const handleConfirm = async () => {
    if (!matrixName.trim()) {
      alert("Tên ma trận không được để trống");
      return;
    }
    setIsLoading(true);
    try {
      await confirmSmartMatrix({
        name: matrixName,
        description: matrixDescription || null,
        allocations: allocations.map((a) => ({ node_id: a.node_id, proposed_count: a.proposed_count })),
        total_questions: totalQuestions,
        level_ratios: levelRatios,
        type_ratios: { SINGLE_CHOICE: 1.0 },
      });
      alert("Tạo ma trận thành công!");
      onClose();
      navigate("/admin/matrix");
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra khi tạo ma trận");
    } finally {
      setIsLoading(false);
    }
  };

  const updateAllocation = (nodeId: number, count: number) => {
    setAllocations((prev) =>
      prev.map((a) => {
        if (a.node_id !== nodeId) return a;
        const newCount = Math.max(0, count);
        return {
          ...a,
          proposed_count: newCount,
          has_warning: newCount > a.question_count,
        };
      })
    );
  };

  const totalProposed = useMemo(() => allocations.reduce((s, a) => s + a.proposed_count, 0), [allocations]);
  const warnings = useMemo(() => allocations.filter((a) => a.has_warning), [allocations]);

  const chartData = useMemo(
    () =>
      allocations.map((a) => ({
        name: a.name.length > 20 ? a.name.slice(0, 18) + "…" : a.name,
        "Đề xuất": a.proposed_count,
        "Có sẵn": a.question_count,
      })),
    [allocations]
  );

  const renderNodeTree = (ns: KnowledgeNode[], depth = 0): React.ReactNode[] => {
    const items: React.ReactNode[] = [];
    for (const node of ns) {
      const isSelected = selectedNodeIds.has(node.id);
      items.push(
        <div
          key={node.id}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
            isSelected
              ? "bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 font-semibold"
              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          }`}
          style={{ marginLeft: depth * 16 }}
          onClick={() => toggleNode(node.id)}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleNode(node.id)}
            className="w-3.5 h-3.5 rounded text-primary-600 focus:ring-primary-500"
          />
          <span className="truncate">{node.name}</span>
          <span className="text-[10px] text-slate-400 ml-auto shrink-0">{node.level || "NODE"}</span>
        </div>
      );
      if (node.children && node.children.length > 0) {
        items.push(...renderNodeTree(node.children, depth + 1));
      }
    }
    return items;
  };

  const stepLabels: Record<Step, string> = {
    scope: "1. Chọn phạm vi",
    propose: "2. Phân bổ câu hỏi",
    confirm: "3. Xác nhận & Tạo",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Trình tạo Ma trận Thông minh">
      <div className="p-6 space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs font-medium">
          {(["scope", "propose", "confirm"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full ${
                step === s ? "bg-primary-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500"
              }`}>
                {stepLabels[s]}
              </span>
              {i < 2 && <span className="text-slate-300">→</span>}
            </div>
          ))}
        </div>

        {/* STEP 1: Scope Selection */}
        {step === "scope" && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Chọn 1 hoặc nhiều node (Topic/Concept) trong cây kiến thức. Hệ thống sẽ tự động lấy tất cả skill lá con và đếm số câu có sẵn.
              </p>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Đã chọn {selectedNodeIds.size} node
              </span>
              <Button variant="ghost" size="sm" onClick={selectAllTopics}>Chọn tất cả Topic</Button>
            </div>

            <div className="max-h-[350px] overflow-y-auto border border-slate-200 dark:border-white/10 rounded-xl p-2 space-y-0.5">
              {nodes.length === 0 ? (
                <div className="text-center p-8 text-slate-500 text-sm">Đang tải cây kiến thức...</div>
              ) : (
                renderNodeTree(nodes)
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleScopeNext} disabled={selectedNodeIds.size === 0 || isLoading} size="lg">
                Tiếp tục <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Propose Allocation */}
        {step === "propose" && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Tìm thấy <strong>{leaves.length} skill lá</strong> với tổng <strong>{totalInBank} câu</strong> trong ngân hàng.
                Nhập tổng số câu mong muốn, hệ thống sẽ đề xuất phân bổ tỷ lệ thuận.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Tổng số câu mong muốn"
                type="number"
                min={1}
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(parseInt(e.target.value) || 1)}
              />
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tỷ lệ mức độ (%)</label>
                <div className="flex gap-1">
                  {[
                    { id: 1, label: "NB" },
                    { id: 2, label: "TH" },
                    { id: 3, label: "VD" },
                    { id: 4, label: "VDC" },
                  ].map((l) => (
                    <input
                      key={l.id}
                      type="number"
                      step="5"
                      className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                      value={Math.round((levelRatios[l.id] || 0) * 100)}
                      onChange={(e) =>
                        setLevelRatios({ ...levelRatios, [l.id]: parseInt(e.target.value) / 100 || 0 })
                      }
                    />
                  ))}
                </div>
                <div className="flex gap-1 text-[10px] text-slate-400">
                  <span className="w-full text-center">NB</span>
                  <span className="w-full text-center">TH</span>
                  <span className="w-full text-center">VD</span>
                  <span className="w-full text-center">VDC</span>
                </div>
              </div>
            </div>

            {/* Leaves table with editable proposed counts */}
            <div className="overflow-x-auto border border-slate-200 dark:border-white/10 rounded-xl max-h-[300px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Skill</th>
                    <th className="px-3 py-2 font-semibold">Path</th>
                    <th className="px-3 py-2 font-semibold text-center">Có sẵn</th>
                    <th className="px-3 py-2 font-semibold text-center">Đề xuất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {leaves.map((leaf) => (
                    <tr key={leaf.node_id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                      <td className="px-3 py-2 font-medium">{leaf.name}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{leaf.path}</td>
                      <td className="px-3 py-2 text-center font-mono">{leaf.question_count}</td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          className="w-16 px-2 py-1 text-sm text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                          defaultValue={0}
                          onBlur={() => {
                            // Value handled via propose endpoint
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep("scope")}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại
              </Button>
              <Button onClick={handleProposeNext} isLoading={isLoading} size="lg">
                Đề xuất phân bổ <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4">
            {warnings.length > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {warnings.length} skill vượt quá số câu có sẵn
                  </span>
                </div>
                <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
                  {warnings.map((w) => (
                    <li key={w.node_id}>• {w.name}: đề xuất {w.proposed_count}, có sẵn {w.question_count}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Tên ma trận *"
                required
                placeholder="VD: Đề thi thử ĐGNL 2026"
                value={matrixName}
                onChange={(e) => setMatrixName(e.target.value)}
              />
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mô tả</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-white/80 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 rounded-xl focus:ring-4 focus:ring-primary-500/20 outline-none"
                  value={matrixDescription}
                  onChange={(e) => setMatrixDescription(e.target.value)}
                  placeholder="Mô tả (tuỳ chọn)..."
                />
              </div>
            </div>

            {/* Bar chart */}
            <div className="glass-card p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Phân bổ: {totalProposed} / {totalQuestions} câu
              </h4>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Đề xuất" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Có sẵn" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Editable allocations */}
            <div className="overflow-x-auto border border-slate-200 dark:border-white/10 rounded-xl max-h-[250px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Skill</th>
                    <th className="px-3 py-2 font-semibold text-center">Có sẵn</th>
                    <th className="px-3 py-2 font-semibold text-center">Đề xuất</th>
                    <th className="px-3 py-2 font-semibold text-center">%</th>
                    <th className="px-3 py-2 font-semibold text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {allocations.map((a) => (
                    <tr key={a.node_id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                      <td className="px-3 py-2">
                        <div className="font-medium">{a.name}</div>
                        <div className="text-[10px] text-slate-400">{a.path}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-mono">{a.question_count}</td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          className="w-16 px-2 py-1 text-sm text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                          value={a.proposed_count}
                          onChange={(e) => updateAllocation(a.node_id, parseInt(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-xs">{a.percentage}%</td>
                      <td className="px-3 py-2 text-center">
                        {a.has_warning ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">
                            VƯỢT
                          </span>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep("propose")}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại
              </Button>
              <Button onClick={handleConfirm} isLoading={isLoading} size="lg" className="shadow-lg shadow-primary-500/20">
                <FileText className="w-4 h-4 mr-1" /> Tạo ma trận
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
