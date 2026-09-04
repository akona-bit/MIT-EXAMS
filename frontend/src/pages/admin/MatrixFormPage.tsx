import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createMatrix,
  getMatrix,
  updateMatrix,
  getMatrixUsage,
  createMatrixVersion,
  checkMatrixFeasibilityLocal,
  generateAiMatrix,
} from "../../api/matrix";
import { getKnowledgeTree } from "../../api/knowledge";
import { passageApi, PassageSearchResponse } from "../../api/passages";
import type { KnowledgeNode, MatrixRule, MatrixRuleGroup } from "../../types";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import SmartMatrixWizard from "../../components/admin/SmartMatrixWizard";
import MatrixVisualization from "../../components/matrix/MatrixVisualization";
import { Layers, Link2, AlertTriangle, Activity, Sparkles, Wand2, Plus, Trash2, Settings, BarChart2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "../../components/ui/Toast";
import MatrixNodeSelector from "../../components/admin/matrix/MatrixNodeSelector";

export default function MatrixFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(Boolean(id));
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const isEditMode = Boolean(id);
  const openSmartWizard = searchParams.get("smart") === "1";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
  const [rules, setRules] = useState<Partial<MatrixRule>[]>([]);
  const [groups, setGroups] = useState<MatrixRuleGroup[]>([]);
  
  // Group selection state
  const [selectedRuleIndices, setSelectedRuleIndices] = useState<Set<number>>(new Set());
  
  // Group Modal state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupLabel, setGroupLabel] = useState("");
  const [reqPassageCode, setReqPassageCode] = useState("");
  const [passages, setPassages] = useState<PassageSearchResponse["results"]>([]);
  
  // Smart Builder state
  const [isSmartWizardOpen, setIsSmartWizardOpen] = useState(openSmartWizard);
  
  // Versioning state
  const [matrixUsage, setMatrixUsage] = useState<{ is_used: boolean; total_runs: number } | null>(null);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);

  // AI Generate State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Health Score State
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [shortages, setShortages] = useState<string[]>([]);
  const [isCheckingFeasibility, setIsCheckingFeasibility] = useState(false);
  const [showVisualization, setShowVisualization] = useState(false);

  useEffect(() => {
    getKnowledgeTree().then(setNodes).catch(console.error);
    passageApi.search("", 100).then(res => setPassages(res.results)).catch(console.error);

    if (!id) return;

    const matrixId = Number(id);
    if (Number.isNaN(matrixId)) {
      navigate("/admin/matrix");
      return;
    }

    getMatrix(matrixId)
      .then((matrix) => {
        setName(matrix.name);
        setDescription(matrix.description || "");
        
        const fetchedGroups = (matrix.groups || []).map(g => ({
          ...g,
          local_id: g.id?.toString() || Math.random().toString(36).slice(2)
        }));
        setGroups(fetchedGroups);
        
        const groupMap = new Map();
        fetchedGroups.forEach(g => {
          if (g.id) groupMap.set(g.id, g.local_id);
        });
        
        setRules((matrix.rules || []).map(r => ({
          ...r,
          group_local_id: r.group_id ? groupMap.get(r.group_id) : undefined
        })));
        
        getMatrixUsage(matrixId).then(setMatrixUsage).catch(console.error);
      })
      .catch((error) => {
        console.error(error);
        toast.error("Không tìm thấy ma trận để chỉnh sửa");
        navigate("/admin/matrix");
      })
      .finally(() => setIsFetching(false));
  }, [id, navigate]);

  useEffect(() => {
    if (rules.length === 0) {
      setHealthScore(null);
      setShortages([]);
      return;
    }
    
    const validRules = rules.filter(r => r.knowledge_node_id && r.count && r.count > 0);
    if (validRules.length === 0) return;

    const timer = setTimeout(() => {
      setIsCheckingFeasibility(true);
      checkMatrixFeasibilityLocal(validRules)
        .then(res => {
          setHealthScore(res.health_score ?? 100);
          setShortages(res.shortages || []);
        })
        .catch(err => {
          console.error("Lỗi kiểm tra khả thi:", err);
        })
        .finally(() => setIsCheckingFeasibility(false));
    }, 1000);

    return () => clearTimeout(timer);
  }, [rules]);

  const handleCreateVersion = async () => {
    if (!id) return;
    setIsCreatingVersion(true);
    try {
      const newMatrix = await createMatrixVersion(Number(id));
      toast.success(`Đã tạo bản sao ma trận mới (ID: ${newMatrix.id}). Đang chuyển sang chỉnh sửa bản sao...`);
      navigate(`/admin/matrix/${newMatrix.id}/edit`);
    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra khi tạo bản sao");
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.warning("Tên ma trận không được để trống");
      return;
    }

    if (isEditMode && matrixUsage?.is_used) {
      toast.warning("Ma trận này đã được sử dụng. Vui lòng bấm 'Tạo bản sao ngay' để chỉnh sửa an toàn trên phiên bản mới.");
      return;
    }

    if (rules.length === 0) {
      toast.warning("Cần ít nhất 1 quy tắc (rule) cho ma trận");
      return;
    }

    const invalidRule = rules.find((r) => !r.knowledge_node_id || !r.question_type || !r.count || r.count <= 0);
    if (invalidRule) {
      toast.warning("Vui lòng điền đầy đủ và hợp lệ thông tin cho tất cả quy tắc (Chủ đề, Dạng câu, Số lượng > 0)");
      return;
    }

    setIsLoading(true);
    try {
      const data = {
        name,
        description: description || null,
        rules: rules.map((r) => ({
          knowledge_node_id: Number(r.knowledge_node_id),
          question_type: r.question_type,
          level: Number(r.level || 1),
          count: Number(r.count || 1),
          part: Number(r.part || 1),
          group_local_id: r.group_local_id,
        })),
        groups: groups.map(g => {
          let pid = g.required_passage_id;
          if (reqPassageCode && !pid) {
             const p = passages.find(x => x.public_code === reqPassageCode);
             if (p) pid = p.id;
          }
          return {
            local_id: g.local_id,
            label: g.label,
            required_passage_id: pid
          }
        })
      };

      if (isEditMode && id) {
        await updateMatrix(Number(id), data);
      } else {
        await createMatrix(data);
      }

      navigate("/admin/matrix");
    } catch (error) {
      console.error(error);
      toast.error(
        isEditMode
          ? "Có lỗi xảy ra khi cập nhật ma trận"
          : "Có lỗi xảy ra khi tạo ma trận",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const addRule = () => {
    setRules([
      ...rules,
      {
        knowledge_node_id: nodes.length > 0 ? nodes[0].id : 0,
        level: 1,
        question_type: "SINGLE_CHOICE",
        count: 1,
        part: 1,
      },
    ]);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    try {
      const res = await generateAiMatrix(aiPrompt);
      if (res.rules && res.rules.length > 0) {
        const newRules = res.rules.filter(r => r.node_id).map(r => ({
          knowledge_node_id: r.node_id!,
          level: r.cognitive_level,
          question_type: r.question_type,
          count: r.count,
          part: 1,
        }));
        setRules([...rules, ...newRules]);
        setAiPrompt("");
        setIsAiModalOpen(false);
      } else {
        toast.warning("AI không tạo được quy tắc nào hợp lệ. Vui lòng thử lại với prompt chi tiết hơn.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi gọi AI sinh ma trận.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const removeRule = (index: number) => {
    const newRules = [...rules];
    newRules.splice(index, 1);
    setRules(newRules);
    
    const newSelected = new Set(selectedRuleIndices);
    newSelected.delete(index);
    setSelectedRuleIndices(newSelected);
  };

  const updateRule = (index: number, field: keyof MatrixRule, value: any) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: value };
    setRules(newRules);
  };

  const toggleSelectRule = (index: number) => {
    const newSet = new Set(selectedRuleIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedRuleIndices(newSet);
  };

  const handleGroupRules = () => {
    if (selectedRuleIndices.size < 2) return;
    setGroupLabel("Nhóm câu " + (groups.length + 1));
    setReqPassageCode("");
    setIsGroupModalOpen(true);
  };

  const submitGroup = async () => {
    let passageId = null;
    if (reqPassageCode) {
      const p = passages.find(x => x.public_code === reqPassageCode);
      if (p) {
        passageId = p.id;
      } else {
        try {
           const fp = await passageApi.getByCode(reqPassageCode);
           passageId = fp.id;
        } catch {
           toast.warning("Mã ngữ liệu không hợp lệ");
           return;
        }
      }
    }
    
    const local_id = Math.random().toString(36).slice(2);
    const newGroup: MatrixRuleGroup = {
      local_id,
      label: groupLabel || null,
      required_passage_id: passageId
    };
    
    setGroups([...groups, newGroup]);
    
    const newRules = [...rules];
    selectedRuleIndices.forEach(idx => {
      newRules[idx].group_local_id = local_id;
    });
    setRules(newRules);
    setSelectedRuleIndices(new Set());
    setIsGroupModalOpen(false);
  };

  const ungroupRule = (index: number) => {
    const newRules = [...rules];
    newRules[index].group_local_id = undefined;
    setRules(newRules);
  };

  const renderNodeOptions = (ns: KnowledgeNode[], depth = 0) => {
    let options: React.ReactNode[] = [];
    for (const node of ns) {
      const prefix = "—".repeat(depth) + (depth > 0 ? " " : "");
      options.push(
        <option key={node.id} value={node.id}>
          {prefix}
          {node.name}
        </option>,
      );
      if (node.children && node.children.length > 0) {
        options = options.concat(renderNodeOptions(node.children, depth + 1));
      }
    }
    return options;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
             {isEditMode ? "Chỉnh sửa ma trận" : "Tạo Ma Trận Mới"}
           </h1>
           <p className="text-slate-500 dark:text-slate-400 mt-1">
             Thiết lập cấu trúc đặc tả để hệ thống tự động sinh đề thi
           </p>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="ghost" onClick={() => navigate(-1)} className="font-semibold">Hủy bỏ</Button>
           <Button onClick={handleSubmit} isLoading={isLoading} size="lg" className="bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/25 px-8 rounded-xl font-bold">
             {isEditMode ? "Lưu thay đổi" : "Lưu ma trận"}
           </Button>
        </div>
      </div>

      {isFetching ? (
        <div className="flex items-center justify-center h-64 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-white/60 dark:border-white/10 backdrop-blur-xl">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8 relative">
          
          {/* Versioning Warning */}
          {isEditMode && matrixUsage?.is_used && (
            <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md">
                   <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-amber-900 dark:text-amber-200 text-lg">Ma trận đang được sử dụng</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1 mb-4 leading-relaxed max-w-3xl">
                    Ma trận này đã được dùng để sinh <strong>{matrixUsage.total_runs}</strong> đề thi.
                    Lưu đè sẽ phá vỡ tính nhất quán của các đề thi đã phát hành. Vui lòng tạo bản sao mới để tiếp tục chỉnh sửa.
                  </p>
                  <Button
                    type="button"
                    onClick={handleCreateVersion}
                    isLoading={isCreatingVersion}
                    className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/30 font-bold"
                  >
                    <Layers className="w-4 h-4 mr-2" /> Tạo Phiên Bản Mới
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             
             {/* LEFT COLUMN: Main Info & Actions */}
             <div className="lg:col-span-2 space-y-8">
                {/* General Info Card */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-3xl p-6 shadow-xl shadow-slate-200/40 dark:shadow-none">
                   <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
                      <Settings className="w-5 h-5 text-primary-500" />
                      Thông tin cơ bản
                   </h2>
                   <div className="space-y-5">
                     <Input
                       label="Tên ma trận"
                       required
                       placeholder="VD: Đề thi khảo sát Toán 12 - Lần 1"
                       value={name}
                       onChange={(e) => setName(e.target.value)}
                       className="text-lg font-semibold"
                     />
                     <div className="space-y-2">
                       <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                         Mô tả chi tiết
                       </label>
                       <textarea
                         rows={3}
                         className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow"
                         value={description}
                         onChange={(e) => setDescription(e.target.value)}
                         placeholder="Ghi chú thêm về mục đích của ma trận này..."
                       />
                     </div>
                   </div>
                </div>

                {/* Rules Builder Workspace */}
                <div className="bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div>
                         <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Layers className="w-5 h-5 text-indigo-500" />
                            Cấu trúc sinh đề
                         </h2>
                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Định nghĩa các tiêu chí lấy câu hỏi từ ngân hàng</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {selectedRuleIndices.size > 1 && (
                          <Button type="button" onClick={handleGroupRules} size="sm" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 shadow-sm font-bold">
                            <Link2 className="w-4 h-4 mr-1.5" /> Gộp {selectedRuleIndices.size} ô
                          </Button>
                        )}

                        <Button type="button" onClick={addRule} size="sm" className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white shadow-md font-bold">
                           <Plus className="w-4 h-4 mr-1" /> Thêm Rule
                        </Button>
                      </div>
                   </div>

                   {rules.length === 0 ? (
                     <div className="text-center p-12 bg-white/50 dark:bg-slate-800/20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700">
                        <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                           <Layers className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Chưa có cấu trúc</h3>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto">
                          Bạn có thể thêm rule thủ công để bắt đầu phân bổ câu hỏi.
                        </p>
                     </div>
                   ) : (
                     <div className="space-y-4">
                       <AnimatePresence>
                         {rules.map((rule, idx) => {
                           const group = rule.group_local_id ? groups.find(g => g.local_id === rule.group_local_id) : null;
                           const isSelected = selectedRuleIndices.has(idx);
                           
                           return (
                             <motion.div 
                               initial={{ opacity: 0, y: 10 }}
                               animate={{ opacity: 1, y: 0 }}
                               exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                               key={idx} 
                               className={`relative flex items-stretch gap-0 rounded-2xl transition-all shadow-sm ${
                                 isSelected ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-300 dark:border-primary-700' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                               }`}
                             >
                               {/* Selector sidebar */}
                               <div className={`w-10 flex flex-col items-center justify-center rounded-l-2xl border-r border-slate-100 dark:border-slate-800 ${isSelected ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-slate-50 dark:bg-slate-950'}`}>
                                 <input 
                                   type="checkbox" 
                                   className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300 cursor-pointer"
                                   checked={isSelected}
                                   onChange={() => toggleSelectRule(idx)}
                                 />
                               </div>

                               {/* Form Fields */}
                               <div className="flex-1 p-4 grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
                                 {group && (
                                   <div className="absolute -top-3 left-12 flex items-center gap-1 bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 shadow-sm z-10">
                                      <Link2 className="w-3 h-3" />
                                      {group.label || "Nhóm"}
                                      <button type="button" onClick={() => ungroupRule(idx)} className="ml-1 hover:text-amber-950 font-black">&times;</button>
                                   </div>
                                 )}

                                 <div className="col-span-2 space-y-1.5">
                                   <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Chủ đề kiến thức</label>
                                   <MatrixNodeSelector
                                     value={rule.knowledge_node_id || null}
                                     onChange={(nodeId) => updateRule(idx, "knowledge_node_id", nodeId || 0)}
                                   />
                                 </div>

                                 <div className="space-y-1.5">
                                   <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Dạng câu</label>
                                   <select
                                     className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                                     value={rule.question_type || "SINGLE_CHOICE"}
                                     onChange={(e) => updateRule(idx, "question_type", e.target.value)}
                                   >
                                     <option value="SINGLE_CHOICE">Trắc nghiệm</option>
                                     <option value="MULTIPLE_CHOICE">Nhiều lựa chọn</option>
                                     <option value="TRUE_FALSE">Đúng Sai</option>
                                     <option value="FILL_IN_BLANK">Điền khuyết</option>
                                   </select>
                                 </div>

                                 <div className="space-y-1.5">
                                   <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Mức độ</label>
                                   <select
                                     className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                                     value={rule.level || 1}
                                     onChange={(e) => updateRule(idx, "level", Number(e.target.value))}
                                   >
                                     <option value={1}>NB</option>
                                     <option value={2}>TH</option>
                                     <option value={3}>VD</option>
                                     <option value={4}>VDC</option>
                                   </select>
                                 </div>

                                 <div className="flex gap-2">
                                   <div className="flex-1 space-y-1.5">
                                     <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Số lượng</label>
                                     <input
                                       type="number" min="1" required
                                       className="w-full px-3 py-2 text-sm font-bold text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                                       value={rule.count || 1}
                                       onChange={(e) => updateRule(idx, "count", Number(e.target.value))}
                                     />
                                   </div>
                                   <div className="pt-5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => removeRule(idx)}
                                        className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        title="Xóa"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                   </div>
                                 </div>
                               </div>
                             </motion.div>
                           );
                         })}
                       </AnimatePresence>
                     </div>
                   )}
                </div>
             </div>

             {/* RIGHT COLUMN: Sidebar (Health & Visualization) */}
             <div className="space-y-6">
                {/* Health Score Panel (Sticky) */}
                <div className="sticky top-24 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-3xl p-6 shadow-xl shadow-slate-200/40 dark:shadow-none">
                   <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                         <Activity className={`w-5 h-5 ${isCheckingFeasibility ? 'text-slate-400 animate-spin' : 'text-emerald-500'}`} />
                         Health Score
                      </h3>
                      <div className="text-3xl font-black tracking-tighter">
                         {healthScore !== null && !isCheckingFeasibility ? (
                            <span className={healthScore === 100 ? 'text-emerald-500' : healthScore >= 80 ? 'text-amber-500' : 'text-red-500'}>
                               {healthScore}%
                            </span>
                         ) : (
                            <span className="text-slate-300 dark:text-slate-700 animate-pulse">--</span>
                         )}
                      </div>
                   </div>

                   {shortages.length > 0 ? (
                     <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl p-4">
                       <p className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5 mb-2">
                         <AlertTriangle className="w-4 h-4" /> Thiếu câu hỏi trong kho
                       </p>
                       <ul className="list-disc pl-4 text-xs font-medium text-red-600 dark:text-red-300 space-y-1">
                         {shortages.slice(0, 5).map((s, i) => <li key={i}>{s}</li>)}
                         {shortages.length > 5 && <li className="text-red-500/70 italic">...và {shortages.length - 5} mục khác</li>}
                       </ul>
                     </div>
                   ) : (
                     <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-xl p-4 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                           <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Khả thi 100%</p>
                           <p className="text-xs text-emerald-600 dark:text-emerald-400/80 mt-0.5">Ngân hàng có đủ câu hỏi để đáp ứng cấu trúc ma trận này.</p>
                        </div>
                     </div>
                   )}

                   <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center mb-4">
                         <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <BarChart2 className="w-4 h-4 text-slate-400" /> Biểu đồ cấu trúc
                         </h4>
                         <button 
                           type="button" 
                           onClick={() => setShowVisualization(!showVisualization)}
                           className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-2 py-1 rounded"
                         >
                           {showVisualization ? "Ẩn đi" : "Hiện thị"}
                         </button>
                      </div>
                      
                      <AnimatePresence>
                         {showVisualization && rules.length > 0 && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                               <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 min-h-[200px]">
                                 <MatrixVisualization 
                                   data={rules.map(r => ({
                                     ...r,
                                     knowledge_node: nodes.find(n => n.id === r.knowledge_node_id)
                                   }))} 
                                 />
                               </div>
                            </motion.div>
                         )}
                      </AnimatePresence>
                   </div>
                </div>
             </div>
          </div>
        </form>
      )}

      {/* Modals remain mostly unchanged in logic, just updated styles inside them if needed. */}
      {/* Group Modal */}
      <Modal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} title="Gộp nhóm câu hỏi">
         <div className="p-6 space-y-4">
            <Input 
               label="Tên nhóm (tuỳ chọn)" 
               placeholder="VD: Nhóm câu 97-99" 
               value={groupLabel} 
               onChange={e => setGroupLabel(e.target.value)} 
            />
            <div className="space-y-2">
               <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Cố định Ngữ liệu (Mã ngữ liệu)</label>
               <input 
                  type="text" 
                  className="w-full px-3 py-2 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-slate-300 dark:border-white/10 rounded-lg focus:ring-4 focus:ring-primary-500/20 outline-none" 
                  placeholder="VD: PASSAGE-123 (Bỏ trống để chọn ngẫu nhiên passage)" 
                  value={reqPassageCode} 
                  onChange={e => setReqPassageCode(e.target.value)}
                  list="passages-list"
               />
               <datalist id="passages-list">
                  {passages.map(p => (
                     <option key={p.public_code} value={p.public_code}>{p.source_title || "Ngữ liệu"}</option>
                  ))}
               </datalist>
               <p className="text-xs text-slate-500">Nếu bỏ trống, hệ thống sẽ tự động tìm 1 ngữ liệu chung thoả mãn tất cả các ô trong nhóm.</p>
            </div>
            <div className="pt-4 flex justify-end gap-3">
               <Button variant="outline" onClick={() => setIsGroupModalOpen(false)}>Hủy</Button>
               <Button onClick={submitGroup}>Xác nhận Gộp nhóm</Button>
            </div>
         </div>
      </Modal>

      {/* AI Generate Modal */}
      <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title="Sinh ma trận bằng AI">
        <div className="p-6 space-y-4">
          <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 p-4 border border-violet-100 dark:border-violet-800/50 flex gap-3 items-start">
            <div className="p-2 bg-violet-200 text-violet-700 rounded-lg shrink-0">
               <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-sm text-violet-800 dark:text-violet-300 leading-relaxed font-medium">
               Nhập yêu cầu bằng ngôn ngữ tự nhiên. AI sẽ phân tích và tự động trích xuất các quy tắc phân bổ chuyên đề, mức độ, dạng câu.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Prompt yêu cầu:</label>
            <textarea
              className="w-full h-32 px-4 py-3 text-sm border rounded-xl resize-none bg-slate-50 focus:bg-white dark:bg-slate-900 dark:border-slate-700 focus:ring-2 focus:ring-violet-500 outline-none transition-all shadow-inner"
              placeholder="VD: Tạo cấu trúc đề thi 1 tiết Toán 12 chương Hàm số gồm 20 câu trắc nghiệm (10 nhận biết, 5 thông hiểu, 5 vận dụng)..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={isGeneratingAi}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setIsAiModalOpen(false)} disabled={isGeneratingAi}>Hủy bỏ</Button>
            <Button onClick={handleAiGenerate} isLoading={isGeneratingAi} className="bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-lg shadow-violet-500/30 px-6 rounded-xl">
              <Sparkles className="w-4 h-4 mr-2" />
              {isGeneratingAi ? "Đang xử lý..." : "Bắt đầu Sinh"}
            </Button>
          </div>
        </div>
      </Modal>

      <SmartMatrixWizard isOpen={isSmartWizardOpen} onClose={() => { setIsSmartWizardOpen(false); navigate("/admin/matrix"); }} />
    </div>
  );
}
