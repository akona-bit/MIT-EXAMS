import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getKnowledgeTree } from "../../api/knowledge";
import { getSmartLeaves, proposeSmartDistribution, confirmSmartMatrix } from "../../api/matrix";
import type { KnowledgeNode } from "../../types";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Modal from "../ui/Modal";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2, FileText, Target, PieChart, CheckSquare, Layers, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
        <motion.div
          key={node.id}
          whileHover={{ x: 4 }}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all ${
            isSelected
              ? "bg-gradient-to-r from-primary-500/10 to-transparent border-l-4 border-primary-500 text-primary-700 dark:text-primary-300 font-semibold shadow-sm"
              : "hover:bg-slate-100/80 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-l-4 border-transparent"
          }`}
          style={{ marginLeft: depth * 24 }}
          onClick={() => toggleNode(node.id)}
        >
          <div className={`flex items-center justify-center w-5 h-5 rounded border ${isSelected ? 'bg-primary-500 border-primary-500' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}>
             {isSelected && <CheckSquare className="w-3.5 h-3.5 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
             <div className="truncate text-sm">{node.name}</div>
          </div>
          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${isSelected ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
            {node.level || "NODE"}
          </span>
        </motion.div>
      );
      if (node.children && node.children.length > 0) {
        items.push(...renderNodeTree(node.children, depth + 1));
      }
    }
    return items;
  };

  const steps = [
    { id: "scope", title: "Phạm vi", icon: Target, desc: "Chọn vùng kiến thức" },
    { id: "propose", title: "Phân bổ", icon: PieChart, desc: "Đề xuất số lượng" },
    { id: "confirm", title: "Xác nhận", icon: CheckCircle2, desc: "Tạo ma trận" },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Smart Builder" maxWidth="max-w-5xl">
      <div className="flex flex-col h-[85vh] max-h-[800px] overflow-hidden bg-slate-50/50 dark:bg-slate-950/50 rounded-b-2xl">
        
        {/* Modern Stepper Header */}
        <div className="shrink-0 px-8 py-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 z-10 shadow-sm">
           <div className="flex items-center justify-between max-w-3xl mx-auto relative">
              {/* Connecting line */}
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 z-0" />
              
              {steps.map((s, idx) => {
                const isActive = step === s.id;
                const isPast = steps.findIndex(x => x.id === step) > idx;
                const Icon = s.icon;
                
                return (
                  <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 ${
                        isActive ? "bg-gradient-to-br from-primary-500 to-indigo-600 text-white scale-110" :
                        isPast ? "bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400" :
                        "bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
                     }`}>
                        <Icon className="w-5 h-5" />
                     </div>
                     <div className="text-center bg-white/80 dark:bg-slate-900/80 px-2 rounded-lg backdrop-blur-sm">
                        <div className={`text-sm font-bold ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{s.title}</div>
                        <div className="text-[10px] text-slate-400">{s.desc}</div>
                     </div>
                  </div>
                );
              })}
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar relative">
          <AnimatePresence mode="wait">
            {step === "scope" && (
              <motion.div 
                key="scope"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 max-w-4xl mx-auto"
              >
                <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
                  <div className="p-3 bg-blue-500 text-white rounded-xl shadow-inner">
                     <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">Chọn chủ đề kiến thức</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Hệ thống sẽ quét kho dữ liệu và tự động trích xuất các kỹ năng (skills) từ các chủ đề bạn chọn.
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-end pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Đã chọn <span className="text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full">{selectedNodeIds.size}</span> chủ đề
                  </div>
                  <Button variant="outline" size="sm" onClick={selectAllTopics} className="bg-white dark:bg-slate-900 shadow-sm">
                     Chọn tất cả Topic
                  </Button>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm min-h-[300px]">
                  {nodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400 space-y-4">
                       <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-primary-500 animate-spin" />
                       <p className="text-sm font-medium">Đang tải cấu trúc tri thức...</p>
                    </div>
                  ) : (
                    <div className="space-y-1">{renderNodeTree(nodes)}</div>
                  )}
                </div>
              </motion.div>
            )}

            {step === "propose" && (
              <motion.div 
                key="propose"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Left Column: Settings */}
                  <div className="w-full lg:w-1/3 space-y-6">
                     <div className="p-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                           <Sparkles className="w-16 h-16" />
                        </div>
                        <h3 className="text-xl font-bold mb-1 relative z-10">AI Phân bổ</h3>
                        <p className="text-sm text-indigo-100 relative z-10 mb-4">
                          Quét thấy <strong className="text-white bg-indigo-900/40 px-1.5 py-0.5 rounded">{leaves.length}</strong> skills với <strong className="text-white bg-indigo-900/40 px-1.5 py-0.5 rounded">{totalInBank}</strong> câu hỏi.
                        </p>
                        
                        <div className="space-y-4 relative z-10">
                           <div className="space-y-1.5">
                              <label className="text-xs font-bold text-indigo-100 uppercase tracking-wider">Tổng số câu thi</label>
                              <input
                                type="number"
                                min={1}
                                className="w-full px-4 py-2.5 text-lg font-bold bg-white/20 border border-white/30 rounded-xl outline-none focus:ring-2 focus:ring-white/50 text-white placeholder:text-white/50"
                                value={totalQuestions}
                                onChange={(e) => setTotalQuestions(parseInt(e.target.value) || 1)}
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-xs font-bold text-indigo-100 uppercase tracking-wider">Tỷ lệ độ khó (%)</label>
                              <div className="grid grid-cols-4 gap-2">
                                {[
                                  { id: 1, label: "NB" },
                                  { id: 2, label: "TH" },
                                  { id: 3, label: "VD" },
                                  { id: 4, label: "VDC" },
                                ].map((l) => (
                                  <div key={l.id} className="text-center space-y-1">
                                    <input
                                      type="number"
                                      step="5"
                                      className="w-full px-1 py-1.5 text-sm font-bold text-center bg-white/20 border border-white/30 rounded-lg outline-none focus:ring-2 focus:ring-white/50 text-white"
                                      value={Math.round((levelRatios[l.id] || 0) * 100)}
                                      onChange={(e) =>
                                        setLevelRatios({ ...levelRatios, [l.id]: parseInt(e.target.value) / 100 || 0 })
                                      }
                                    />
                                    <div className="text-[10px] text-indigo-200 font-bold">{l.label}</div>
                                  </div>
                                ))}
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Right Column: Allocation Table */}
                  <div className="w-full lg:w-2/3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[500px]">
                     <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">Bảng phân bổ chi tiết</h4>
                     </div>
                     <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                           <thead className="bg-white dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                             <tr>
                               <th className="px-4 py-3 font-bold text-slate-500 uppercase text-xs tracking-wider">Kỹ năng (Skill)</th>
                               <th className="px-4 py-3 font-bold text-slate-500 uppercase text-xs tracking-wider text-center">Có sẵn</th>
                               <th className="px-4 py-3 font-bold text-primary-600 uppercase text-xs tracking-wider text-center">Đề xuất</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                             {leaves.map((leaf) => (
                               <tr key={leaf.node_id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                 <td className="px-4 py-3">
                                   <div className="font-semibold text-slate-800 dark:text-slate-200">{leaf.name}</div>
                                   <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">{leaf.path}</div>
                                 </td>
                                 <td className="px-4 py-3 text-center">
                                    <span className="inline-block px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-mono text-xs text-slate-600 dark:text-slate-300">
                                       {leaf.question_count}
                                    </span>
                                 </td>
                                 <td className="px-4 py-3 text-center">
                                   <input
                                     type="number"
                                     min={0}
                                     className="w-16 px-2 py-1.5 text-sm font-bold text-center bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
                                     value={allocations.find(a => a.node_id === leaf.node_id)?.proposed_count || 0}
                                     onChange={(e) => updateAllocation(leaf.node_id, parseInt(e.target.value) || 0)}
                                   />
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "confirm" && (
              <motion.div 
                key="confirm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 max-w-5xl mx-auto"
              >
                {warnings.length > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                         <AlertTriangle className="w-5 h-5 text-amber-600" />
                      </div>
                      <span className="text-base font-bold text-amber-800 dark:text-amber-400">
                        Cảnh báo: Có {warnings.length} kỹ năng thiếu câu hỏi
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {warnings.map((w) => (
                        <div key={w.node_id} className="bg-white/60 dark:bg-slate-900/60 px-3 py-2 rounded-xl border border-amber-200/50 flex justify-between items-center">
                           <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 truncate pr-2">{w.name}</span>
                           <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded">Cần {w.proposed_count} / Có {w.question_count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   {/* Form Details */}
                   <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-6 space-y-6">
                      <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                         <FileText className="w-5 h-5 text-primary-500" /> Thông tin ma trận
                      </h4>
                      <Input
                        label="Tên ma trận"
                        required
                        placeholder="VD: Đề thi thử ĐGNL 2026"
                        value={matrixName}
                        onChange={(e) => setMatrixName(e.target.value)}
                      />
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Mô tả chi tiết</label>
                        <textarea
                          rows={3}
                          className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow"
                          value={matrixDescription}
                          onChange={(e) => setMatrixDescription(e.target.value)}
                          placeholder="Nhập mô tả (tuỳ chọn)..."
                        />
                      </div>
                   </div>

                   {/* Chart Visualization */}
                   <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-6 flex flex-col">
                      <div className="flex justify-between items-center mb-6">
                         <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-indigo-500" /> Trực quan hoá
                         </h4>
                         <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold text-sm rounded-full">
                            TỔNG: {totalProposed} / {totalQuestions}
                         </span>
                      </div>
                      <div className="flex-1 min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} />
                            <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                            <Legend wrapperStyle={{paddingTop: '20px'}} />
                            <Bar dataKey="Đề xuất" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12} />
                            <Bar dataKey="Có sẵn" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={12} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
          <Button variant="outline" size="lg" onClick={() => {
             if (step === "propose") setStep("scope");
             else if (step === "confirm") setStep("propose");
             else onClose();
          }} className="font-bold text-slate-500 bg-slate-50">
            {step === "scope" ? "Đóng" : <><ArrowLeft className="w-5 h-5 mr-2" /> Quay lại</>}
          </Button>

          {step === "scope" && (
            <Button onClick={handleScopeNext} disabled={selectedNodeIds.size === 0 || isLoading} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 rounded-xl px-8">
              Phân bổ số lượng <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}
          {step === "propose" && (
            <Button onClick={handleProposeNext} isLoading={isLoading} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-500/30 rounded-xl px-8">
              Xác nhận kết quả <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}
          {step === "confirm" && (
            <Button onClick={handleConfirm} isLoading={isLoading} size="lg" className="bg-gradient-to-r from-primary-500 to-indigo-600 text-white font-bold shadow-xl shadow-primary-500/30 rounded-xl px-10 text-lg py-3">
              <CheckCircle2 className="w-5 h-5 mr-2" /> Tạo Ma Trận Ngay
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
