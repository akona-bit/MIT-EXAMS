import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createMatrix,
  getMatrix,
  updateMatrix,
} from "../../api/matrix";
import { getKnowledgeTree } from "../../api/knowledge";
import { passageApi, PassageSearchResponse } from "../../api/passages";
import type { KnowledgeNode, MatrixRule, MatrixRuleGroup } from "../../types";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import { Layers, Link2 } from "lucide-react";

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
        
        // Map backend groups to local_id
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
      })
      .catch((error) => {
        console.error(error);
        alert("Không tìm thấy ma trận để chỉnh sửa");
        navigate("/admin/matrix");
      })
      .finally(() => setIsFetching(false));
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Tên ma trận không được để trống");
      return;
    }

    if (rules.length === 0) {
      alert("Cần ít nhất 1 quy tắc (rule) cho ma trận");
      return;
    }

    const invalidRule = rules.find((r) => !r.knowledge_node_id || !r.question_type || !r.count || r.count <= 0);
    if (invalidRule) {
      alert("Vui lòng điền đầy đủ và hợp lệ thông tin cho tất cả quy tắc (Chủ đề, Dạng câu, Số lượng > 0)");
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
      alert(
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
        question_type: "SINGLE_CHOICE",
        level: 1,
        count: 1,
        part: 1,
      },
    ]);
  };

  const removeRule = (index: number) => {
    const newRules = [...rules];
    newRules.splice(index, 1);
    setRules(newRules);
    
    // Clean up selected indices if needed
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
        // try to fetch code
        try {
           const fp = await passageApi.getByCode(reqPassageCode);
           passageId = fp.id;
        } catch {
           alert("Mã ngữ liệu không hợp lệ");
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
    
    // Update rules
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-gradient pb-1">
          {isEditMode ? "Chỉnh sửa ma trận" : "Thêm ma trận mới"}
        </h1>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Quay lại
        </Button>
      </div>

      {isFetching ? (
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-8 text-center text-sm text-slate-500 backdrop-blur-xl">
          Đang tải dữ liệu ma trận...
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="glass-card space-y-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Tên ma trận"
              required
              placeholder="VD: Đề thi thử ĐGNL 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                Mô tả
              </label>
              <textarea
                rows={2}
                className="w-full px-4 py-2.5 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 rounded-xl shadow-[0_4px_12px_rgb(0,0,0,0.05)] focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all outline-none backdrop-blur-md"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nhập mô tả ma trận (tuỳ chọn)..."
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                  Cấu trúc đề thi (Rules)
                </h3>
                {selectedRuleIndices.size > 1 && (
                  <Button type="button" onClick={handleGroupRules} size="sm" variant="outline" className="flex items-center gap-1.5 border-primary-500 text-primary-600 bg-primary-50 dark:bg-primary-500/10">
                    <Layers className="w-4 h-4" />
                    Gộp {selectedRuleIndices.size} ô thành nhóm
                  </Button>
                )}
              </div>
              <Button type="button" onClick={addRule} size="sm" variant="outline">
                + Thêm quy tắc
              </Button>
            </div>

            {rules.length === 0 ? (
              <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Chưa có quy tắc nào. Bấm nút "Thêm quy tắc" để bắt đầu.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {rules.map((rule, idx) => {
                  const group = rule.group_local_id ? groups.find(g => g.local_id === rule.group_local_id) : null;
                  const isSelected = selectedRuleIndices.has(idx);
                  
                  return (
                    <div key={idx} className={`p-4 bg-slate-50 dark:bg-slate-800/50 border ${isSelected ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-white/5'} rounded-xl flex flex-col md:flex-row gap-4 items-end transition-colors relative`}>
                      
                      <div className="flex items-center justify-center pb-2 pl-2">
                        <input type="checkbox" className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300 dark:border-slate-600 bg-transparent"
                          checked={isSelected}
                          onChange={() => toggleSelectRule(idx)}
                        />
                      </div>
                      
                      {group && (
                        <div className="absolute -top-3 left-10 flex items-center gap-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 shadow-sm z-10">
                           <Link2 className="w-3 h-3" />
                           {group.label || "Nhóm"}
                           <button type="button" onClick={() => ungroupRule(idx)} className="ml-1 hover:text-amber-900">&times;</button>
                        </div>
                      )}
                      
                      <div className="w-full md:w-1/3 space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Chủ đề kiến thức</label>
                        <select
                          required
                          className="w-full px-3 py-2 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 rounded-lg shadow-sm focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all outline-none backdrop-blur-md"
                          value={rule.knowledge_node_id || ""}
                          onChange={(e) => updateRule(idx, "knowledge_node_id", Number(e.target.value))}
                        >
                          <option value="" disabled>-- Chọn chủ đề --</option>
                          {renderNodeOptions(nodes)}
                        </select>
                      </div>

                      <div className="w-full md:w-1/6 space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Dạng câu</label>
                        <select
                          className="w-full px-3 py-2 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 rounded-lg shadow-sm focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all outline-none backdrop-blur-md"
                          value={rule.question_type || "SINGLE_CHOICE"}
                          onChange={(e) => updateRule(idx, "question_type", e.target.value)}
                        >
                          <option value="SINGLE_CHOICE">Trắc nghiệm</option>
                          <option value="MULTIPLE_CHOICE">Nhiều lựa chọn</option>
                          <option value="TRUE_FALSE">Đúng / Sai</option>
                          <option value="FILL_IN_BLANK">Điền khuyết</option>
                          <option value="COMPOSITE">Câu hỏi chùm</option>
                        </select>
                      </div>

                      <div className="w-full md:w-1/6 space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mức độ</label>
                        <select
                          className="w-full px-3 py-2 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 rounded-lg shadow-sm focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all outline-none backdrop-blur-md"
                          value={rule.level || 1}
                          onChange={(e) => updateRule(idx, "level", Number(e.target.value))}
                        >
                          <option value={1}>Nhận biết</option>
                          <option value={2}>Thông hiểu</option>
                          <option value={3}>Vận dụng</option>
                          <option value={4}>Vận dụng cao</option>
                        </select>
                      </div>
                      
                      <div className="w-full md:w-1/6 space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Phần thi</label>
                        <select
                          className="w-full px-3 py-2 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 rounded-lg shadow-sm focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all outline-none backdrop-blur-md"
                          value={rule.part || 1}
                          onChange={(e) => updateRule(idx, "part", Number(e.target.value))}
                        >
                          <option value={1}>Phần 1 - Tiếng Việt</option>
                          <option value={2}>Phần 2 - Tiếng Anh</option>
                          <option value={3}>Phần 3 - Toán</option>
                          <option value={4}>Phần 4 - Khoa học</option>
                        </select>
                      </div>

                      <div className="w-full md:w-1/6 space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Số lượng</label>
                        <input
                          type="number"
                          min="1"
                          required
                          className="w-full px-3 py-2 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 rounded-lg shadow-sm focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all outline-none backdrop-blur-md"
                          value={rule.count || 1}
                          onChange={(e) => updateRule(idx, "count", Number(e.target.value))}
                        />
                      </div>

                      <div className="pb-1">
                        <button
                          type="button"
                          onClick={() => removeRule(idx)}
                          className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-6 border-t border-slate-200 dark:border-white/10">
            <Button type="submit" isLoading={isLoading} size="lg" className="shadow-lg shadow-primary-500/20">
              {isEditMode ? "Cập nhật ma trận" : "Lưu ma trận"}
            </Button>
          </div>
        </form>
      )}

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
                  className="w-full px-3 py-2 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-slate-300 dark:border-white/10 rounded-lg shadow-sm focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all outline-none backdrop-blur-md" 
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
               <Button onClick={submitGroup}>Gộp nhóm</Button>
            </div>
         </div>
      </Modal>
    </div>
  );
}
