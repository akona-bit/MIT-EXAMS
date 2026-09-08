import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createMatrix,
  getMatrix,
  updateMatrix,
  getMatrixUsage,
  createMatrixVersion,
  checkMatrixFeasibilityLocal,

} from "../../api/matrix";
import { getKnowledgeTree } from "../../api/knowledge";
import { passageApi, PassageSearchResponse } from "../../api/passages";
import type { KnowledgeNode, MatrixRule, MatrixRuleGroup } from "../../types";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import DgnlBlueprintModal from "../../components/admin/matrix/DgnlBlueprintModal";
import MatrixVisualization from "../../components/matrix/MatrixVisualization";
import { Layers, Link2, AlertTriangle, Activity, Settings, BarChart2, CheckCircle2, Blocks } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "../../components/ui/Toast";
import MatrixNodeSelector from "../../components/admin/matrix/MatrixNodeSelector";

export default function MatrixFormPage() {
  const { id } = useParams();

  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(Boolean(id));
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const isEditMode = Boolean(id);

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
  
  // DGNL Blueprint state
  const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  
  const handleApplyBlueprint = (data: { rules: any[]; groups: any[] }) => {
    setRules(data.rules);
    setGroups(data.groups);
    if (!name) setName("Ma trận ĐGNL ĐHQG-HCM chuẩn");
  };
  
  // Versioning state
  const [matrixUsage, setMatrixUsage] = useState<{ is_used: boolean; total_runs: number } | null>(null);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);

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


    const checkFeasibility = async () => {
    if (rules.length === 0) return;
    setIsCheckingFeasibility(true);
    try {
      const res = await checkMatrixFeasibilityLocal(rules);
      setHealthScore(res.health_score ?? null);
      setShortages(res.shortages || []);
    } catch (err: any) {
      console.error(err);
      setHealthScore(null);
    } finally {
      setIsCheckingFeasibility(false);
    }
  };



    const timer = setTimeout(() => {
      checkFeasibility();
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

    const invalidRule = rules.find((r) => !r.knowledge_node_id || !r.count || r.count <= 0);
    if (invalidRule) {
      toast.warning("Vui lòng điền đầy đủ và hợp lệ thông tin cho tất cả quy tắc (Chủ đề, Số lượng > 0)");
      return;
    }

    setIsLoading(true);
    try {
      const data = {
        name,
        description: description || null,
        rules: rules.map((r) => ({
          knowledge_node_id: Number(r.knowledge_node_id),
          question_type: r.question_type || null,
          level: r.level ? Number(r.level) : null,
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

  const ungroupRule = (idx: number) => {
    // TODO: implement ungroupRule
    void idx;
  };

  const submitGroup = () => {
    // TODO: implement submitGroup
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
           {!isEditMode && (
             <Button variant="outline" onClick={() => setIsBlueprintOpen(true)} className="font-semibold">
               <Blocks className="w-4 h-4 mr-2" /> Blueprint ĐGNL 120 câu
             </Button>
           )}
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
                <div className="bg-white/80 dark:bg-[#0b1121]/60 backdrop-blur-2xl border border-white/60 dark:border-primary-900/50 rounded-3xl p-6 shadow-xl shadow-slate-200/40 dark:shadow-[0_0_40px_-15px_rgba(30,58,138,0.3)]">
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
                         className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-[#0b1121]/80 border border-slate-200 dark:border-primary-900/50 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-inner dark:shadow-black/20"
                         value={description}
                         onChange={(e) => setDescription(e.target.value)}
                         placeholder="Ghi chú thêm về mục đích của ma trận này..."
                       />
                     </div>
                   </div>
                </div>

                {/* Rules Builder Workspace */}
                <div className="bg-slate-100/50 dark:bg-[#0b1121]/40 border border-slate-200/80 dark:border-primary-900/50 rounded-3xl p-6 backdrop-blur-xl shadow-inner dark:shadow-black/10">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div>
                         <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Layers className="w-5 h-5 text-indigo-500" />
                            Cấu trúc sinh đề
                         </h2>
                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Định nghĩa các tiêu chí lấy câu hỏi từ ngân hàng</p>
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
                               className={`relative flex items-stretch gap-0 rounded-2xl transition-all duration-300 shadow-sm ${
                                 isSelected ? 'bg-primary-50 dark:bg-primary-900/30 border border-primary-300 dark:border-primary-600 dark:shadow-[0_0_20px_-5px_rgba(30,58,138,0.4)]' : 'bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-700/50 hover:border-primary-300 dark:hover:border-primary-700/50'
                               }`}
                             >
                               {/* Selector sidebar */}
                               <div className={`w-10 flex flex-col items-center justify-center rounded-l-2xl border-r border-slate-100 dark:border-slate-800/50 transition-colors ${isSelected ? 'bg-primary-100 dark:bg-primary-800/40' : 'bg-slate-50 dark:bg-slate-900/50'}`}>
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
                                   <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Dạng câu (Cố định)</label>
                                   <select
                                     disabled={!rule.question_type}
                                     className="w-full px-3 py-2 text-sm font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-500 border border-slate-200 dark:border-slate-700/50 rounded-lg outline-none"
                                     value={rule.question_type || ""}
                                     onChange={(e) => updateRule(idx, "question_type", e.target.value)}
                                   >
                                     <option value="">Tự động chọn</option>
                                     <option value="SINGLE_CHOICE">Trắc nghiệm</option>
                                   </select>
                                 </div>

                                 <div className="space-y-1.5">
                                   <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Mức độ</label>
                                   <select
                                     className="w-full px-3 py-2 text-sm font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-500 border border-slate-200 dark:border-slate-700/50 rounded-lg outline-none"
                                     value={rule.level || ""}
                                     onChange={(e) => updateRule(idx, "level", e.target.value ? Number(e.target.value) : undefined)}
                                   >
                                     <option value="">Tự động cân bằng</option>
                                     <option value={1}>Nhận biết</option>
                                     <option value={2}>Thông hiểu</option>
                                     <option value={3}>Vận dụng</option>
                                     <option value={4}>Vận dụng cao</option>
                                   </select>
                                 </div>

                                 <div className="flex gap-2">
                                   <div className="flex-1 space-y-1.5">
                                     <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Số lượng (Cố định)</label>
                                     <input
                                       type="number" min="1" disabled
                                       className="w-full px-3 py-2 text-sm font-bold text-center bg-slate-100 dark:bg-slate-800/80 text-slate-500 border border-slate-200 dark:border-slate-700/50 rounded-lg outline-none"
                                       value={rule.count || 1}
                                     />
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
                <div className="sticky top-24 bg-white/80 dark:bg-[#0b1121]/60 backdrop-blur-2xl border border-white/60 dark:border-primary-900/50 rounded-3xl p-6 shadow-xl shadow-slate-200/40 dark:shadow-[0_0_40px_-15px_rgba(30,58,138,0.3)]">
                   <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800/50 pb-4">
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
                               <div className="bg-slate-50 dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-700/50 rounded-xl p-2 min-h-[200px]">
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

        <DgnlBlueprintModal
          isOpen={isBlueprintOpen}
          onClose={() => setIsBlueprintOpen(false)}
          onApply={handleApplyBlueprint}
        />
    </div>
  );
}
