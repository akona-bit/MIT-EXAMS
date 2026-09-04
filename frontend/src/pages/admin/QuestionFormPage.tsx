import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createQuestion,
  getQuestion,
  updateQuestion,
  checkDuplicate,
  suggestQuestionTags,
  type AiSuggestTagsResponse,
  type AiSuggestedNode,
} from "../../api/questions";
import { passageApi, PassageSearchResponse } from "../../api/passages";
import type { QuestionCreate, QuestionSimilarityResponse } from "../../types";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import MarkdownEditor from "../../components/editor/MarkdownEditor";
import KnowledgeNodeSelector from "../../components/admin/question/KnowledgeNodeSelector";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { AlertCircle, Search, Plus, Trash2, Sparkles, Check } from "lucide-react";
import { toast } from "../../components/ui/Toast";

export default function QuestionFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(Boolean(id));
  const isEditMode = Boolean(id);

  const [content, setContent] = useState("");
  const [level, setLevel] = useState(1);
  const [type, setType] = useState("SINGLE_CHOICE");
  
  // Knowledge Node State
  const [subject, setSubject] = useState("Toán"); // Default subject
  const [primaryNodeId, setPrimaryNodeId] = useState<number | null>(null);
  const [secondaryNodeIds, setSecondaryNodeIds] = useState<number[]>([]);

  const [sourceAuthor, setSourceAuthor] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  
  // Answers state
  const [answers, setAnswers] = useState([
    { content: "", is_correct: true, position: 1 },
    { content: "", is_correct: false, position: 2 },
    { content: "", is_correct: false, position: 3 },
    { content: "", is_correct: false, position: 4 },
  ]);

  // SubItems for TRUE_FALSE / COMPOSITE
  const [subItems, setSubItems] = useState([
    { label: "a", prompt: "", position: 1, point_weight: 0.25, kind: "tf", answers: [{ content: "Đúng", is_correct: true, position: 1 }, { content: "Sai", is_correct: false, position: 2 }] },
    { label: "b", prompt: "", position: 2, point_weight: 0.25, kind: "tf", answers: [{ content: "Đúng", is_correct: true, position: 1 }, { content: "Sai", is_correct: false, position: 2 }] },
    { label: "c", prompt: "", position: 3, point_weight: 0.25, kind: "tf", answers: [{ content: "Đúng", is_correct: true, position: 1 }, { content: "Sai", is_correct: false, position: 2 }] },
    { label: "d", prompt: "", position: 4, point_weight: 0.25, kind: "tf", answers: [{ content: "Đúng", is_correct: true, position: 1 }, { content: "Sai", is_correct: false, position: 2 }] },
  ]);
  
  // FILL_IN_BLANK state
  const [fibAnswer, setFibAnswer] = useState("");

  const [duplicates, setDuplicates] = useState<QuestionSimilarityResponse[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  // Passage state
  const [passageSearch, setPassageSearch] = useState("");
  const [passageResults, setPassageResults] = useState<PassageSearchResponse["results"]>([]);
  const [selectedPassageId, setSelectedPassageId] = useState<number | null>(null);
  const [selectedPassagePreview, setSelectedPassagePreview] = useState("");
  const [isSearchingPassage, setIsSearchingPassage] = useState(false);

  // AI Suggest Tags state
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestTagsResponse | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<{primary?: boolean; secondary: number[]}>({primary: false, secondary: []});
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!id) return;
    const questionId = Number(id);
    if (Number.isNaN(questionId)) {
      navigate("/admin/questions");
      return;
    }

    getQuestion(questionId)
      .then((question: any) => {
        setContent(question.content);
        setLevel(question.level);
        setType(question.type || "SINGLE_CHOICE");
        
        // Setup nodes
        if (question.skill_tags) {
          const primaryTag = question.skill_tags.find((t: any) => t.is_primary);
          if (primaryTag) setPrimaryNodeId(primaryTag.knowledge_node_id);
          setSecondaryNodeIds(question.skill_tags.filter((t: any) => !t.is_primary).map((t: any) => t.knowledge_node_id));
        } else if (question.primary_knowledge_node_id) { // Fallback just in case
          setPrimaryNodeId(question.primary_knowledge_node_id);
        } else if (question.knowledge_node_id) {
          setPrimaryNodeId(question.knowledge_node_id);
        }
        
        setSourceAuthor(question.source_author || "");
        setSourceTitle(question.source_title || "");
        
        if (question.passage_id) {
          setSelectedPassageId(question.passage_id);
          setSelectedPassagePreview(`Ngữ liệu ID #${question.passage_id}`);
        }
        
        if (question.type === "FILL_IN_BLANK") {
          setFibAnswer(question.answers[0]?.content || "");
        } else if (question.type === "TRUE_FALSE") {
          if (question.sub_items && question.sub_items.length > 0) {
            setSubItems(question.sub_items.map((si: any) => ({
              ...si,
              answers: si.answers && si.answers.length > 0 ? si.answers : [
                { content: "Đúng", is_correct: true, position: 1 },
                { content: "Sai", is_correct: false, position: 2 }
              ]
            })));
          }
        } else {
          setAnswers(
            question.answers.length > 0
              ? question.answers.slice().sort((a: any, b: any) => a.position - b.position)
              : [
                  { content: "", is_correct: true, position: 1 },
                  { content: "", is_correct: false, position: 2 }
                ]
          );
        }
      })
      .catch((error) => {
        console.error(error);
        toast.error("Không tìm thấy câu hỏi để chỉnh sửa");
        navigate("/admin/questions");
      })
      .finally(() => setIsFetching(false));
  }, [id, navigate]);

  // Passage Search Effect
  useEffect(() => {
    if (!passageSearch.trim()) {
      setPassageResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearchingPassage(true);
      passageApi.search(passageSearch, 5).then(res => {
        setPassageResults(res.results);
      }).catch(console.error).finally(() => setIsSearchingPassage(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [passageSearch]);

  const analyzeWithAi = async () => {
    if (!content.trim() || content.length < 20) {
      toast.warning("Nội dung quá ngắn để AI phân tích. Vui lòng nhập chi tiết hơn.");
      return;
    }
    
    setIsSuggesting(true);
    try {
      const answerTexts = answers.map((a, i) => `${String.fromCharCode(65 + i)}. ${a.content}`).filter(a => a.length > 4);
      const res = await suggestQuestionTags({
        content,
        answers: answerTexts.length > 0 ? answerTexts : undefined,
      });
      setAiSuggestions(res);
      setAcceptedSuggestions({primary: false, secondary: []});
      if (res.cognitive_level) {
        setLevel(res.cognitive_level);
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi gọi AI. Vui lòng thử lại sau.");
    } finally {
      setIsSuggesting(false);
    }
  };
  const applyTypeChange = (newType: string) => {
    setType(newType);
    if (newType === "TRUE_FALSE") {
      // SubItems logic is handled by subItems state already. No need to set answers.
    } else if (newType === "SINGLE_CHOICE" || newType === "MULTIPLE_CHOICE") {
      setAnswers([
        { content: "", is_correct: true, position: 1 },
        { content: "", is_correct: false, position: 2 },
        { content: "", is_correct: false, position: 3 },
        { content: "", is_correct: false, position: 4 },
      ]);
    } else if (newType === "COMPOSITE") {
       toast.info("Dạng câu hỏi chùm (COMPOSITE) sẽ được thiết kế ở phiên bản sau.");
       setType("SINGLE_CHOICE");
    }
  };

  const handleTypeChange = (newType: string) => {
    if (content || answers.some(a => a.content) || fibAnswer) {
      setConfirmMessage("Thay đổi dạng câu hỏi có thể làm mất dữ liệu bạn đang nhập. Chắc chắn tiếp tục?");
      setConfirmAction(() => () => { applyTypeChange(newType); });
      setConfirmOpen(true);
      return;
    }
    applyTypeChange(newType);
  };

  const acceptAiSuggestion = (node: AiSuggestedNode, isPrimary: boolean) => {
    if (!node.node_id) {
      toast.warning(`Chủ đề "${node.name}" chưa có trong hệ thống. Vui lòng chọn thủ công hoặc tạo mới trước.`);
      return;
    }
    
    if (isPrimary) {
      setPrimaryNodeId(node.node_id);
      setAcceptedSuggestions(prev => ({...prev, primary: true}));
    } else {
      if (!secondaryNodeIds.includes(node.node_id)) {
        setSecondaryNodeIds(prev => [...prev, node.node_id!]);
      }
      setAcceptedSuggestions(prev => ({
        ...prev, 
        secondary: [...prev.secondary, node.name as any]
      }));
    }
  };

  const getNormalizedAnswers = () => {
    if (type === "FILL_IN_BLANK") {
      return [{ content: fibAnswer.trim(), is_correct: true, position: 1 }];
    } else {
      return answers
        .map((a, idx) => ({ ...a, content: a.content.trim(), position: idx + 1 }))
        .filter(a => a.content.length > 0);
    }
  };

  const validateForm = () => {
    if (!primaryNodeId) return "Vui lòng chọn Kỹ năng (Skill) chính";
    if (!content.trim()) return "Nội dung câu hỏi không được để trống";
    
    if (type === "SINGLE_CHOICE") {
      const normalizedAnswers = getNormalizedAnswers();
      if (normalizedAnswers.length < 2) return "Cần nhập ít nhất 2 đáp án";
      if (normalizedAnswers.filter(a => a.is_correct).length !== 1) return "Vui lòng chọn ĐÚNG 1 đáp án đúng";
    } else if (type === "MULTIPLE_CHOICE") {
      const normalizedAnswers = getNormalizedAnswers();
      if (normalizedAnswers.length < 2) return "Cần nhập ít nhất 2 đáp án";
      if (normalizedAnswers.filter(a => a.is_correct).length < 1) return "Vui lòng chọn ÍT NHẤT 1 đáp án đúng";
    } else if (type === "FILL_IN_BLANK") {
      if (!fibAnswer.trim()) return "Vui lòng nhập đáp án điền khuyết";
    } else if (type === "TRUE_FALSE") {
      if (subItems.length === 0) return "Cần ít nhất 1 ý phụ";
      for (let i = 0; i < subItems.length; i++) {
        if (!subItems[i].prompt?.trim()) return `Vui lòng nhập nội dung cho ý ${subItems[i].label}`;
      }
    }
    
    return null;
  };

  const submitQuestion = async () => {
    setIsLoading(true);
    try {
      const data: QuestionCreate = {
        content,
        level,
        type,
        primary_knowledge_node_id: primaryNodeId as number,
        secondary_knowledge_node_ids: secondaryNodeIds,
        passage_id: selectedPassageId,
        source_author: sourceAuthor || undefined,
        source_title: sourceTitle || undefined,
        answers: type === "TRUE_FALSE" ? [] : getNormalizedAnswers(),
        sub_items: type === "TRUE_FALSE" ? subItems.map(s => ({...s, prompt: s.prompt?.trim()})) : undefined,
      };

      if (isEditMode && id) {
        await updateQuestion(Number(id), data as any);
      } else {
        await createQuestion(data);
      }
      navigate("/admin/questions");
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Có lỗi xảy ra khi lưu câu hỏi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const error = validateForm();
    if (error) {
      toast.error(String(error));
      return;
    }

    submitQuestion();
  };

  const handleDuplicateCheck = async () => {
    if (!primaryNodeId) { toast.warning("Vui lòng chọn Kỹ năng (Skill) chính trước"); return; }
    if (!content.trim()) { toast.warning("Vui lòng nhập nội dung câu hỏi"); return; }
    
    setIsLoading(true);
    try {
      const dups = await checkDuplicate(content, primaryNodeId);
      if (dups.length > 0) {
        setDuplicates(dups);
        setShowDuplicateDialog(true);
      } else {
        toast.success("Không tìm thấy câu hỏi trùng lặp nào! (Độ an toàn cao)");
      }
    } catch (err) {
      console.error("Duplicate check failed", err);
      toast.error("Lỗi khi kiểm tra trùng lặp");
    } finally {
      setIsLoading(false);
    }
  };

  const updateAnswer = (index: number, val: string) => {
    const newAnswers = [...answers];
    newAnswers[index].content = val;
    setAnswers(newAnswers);
  };

  const setCorrectAnswer = (index: number, isMulti: boolean = false) => {
    if (isMulti) {
      const newAnswers = [...answers];
      newAnswers[index].is_correct = !newAnswers[index].is_correct;
      setAnswers(newAnswers);
    } else {
      const newAnswers = answers.map((a, i) => ({
        ...a,
        is_correct: i === index,
      }));
      setAnswers(newAnswers);
    }
  };

  const addAnswer = () => {
    setAnswers([...answers, { content: "", is_correct: false, position: answers.length + 1 }]);
  };

  const removeAnswer = (index: number) => {
    const newAnswers = answers.filter((_, i) => i !== index);
    setAnswers(newAnswers);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-gradient pb-1">
          {isEditMode ? "Chỉnh sửa câu hỏi" : "Thêm câu hỏi mới"}
        </h1>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Quay lại
        </Button>
      </div>

      {isFetching ? (
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-8 text-center text-sm text-slate-500 backdrop-blur-xl">
          Đang tải dữ liệu câu hỏi...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="glass-card space-y-6">
            <h2 className="text-lg font-bold border-b border-slate-200 pb-2 dark:border-slate-700">1. Phân loại & Ma trận</h2>
            
            {/* Môn học và Kỹ năng */}
            <div className="space-y-6 bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/50">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="w-full sm:w-1/3 space-y-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Môn học
                  </label>
                  <select
                    className="w-full px-4 py-2.5 text-sm font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50 shadow-sm"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  >
                    <option value="Toán">Toán</option>
                    <option value="Vật lí">Vật lí</option>
                    <option value="Hóa học">Hóa học</option>
                    <option value="Sinh học">Sinh học</option>
                    <option value="Lịch sử">Lịch sử</option>
                    <option value="Địa lí">Địa lí</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Ngữ văn">Ngữ văn</option>
                  </select>
                </div>
                
                <div className="w-full sm:w-2/3">
                  <KnowledgeNodeSelector 
                    primaryValue={primaryNodeId} 
                    onPrimaryChange={setPrimaryNodeId}
                    secondaryValues={secondaryNodeIds}
                    onSecondaryChange={setSecondaryNodeIds}
                    subject={subject} 
                  />
                </div>
              </div>
            </div>



            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Mức độ
                </label>
                <select
                  className="w-full px-4 py-2.5 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50"
                  value={level}
                  onChange={(e) => setLevel(Number(e.target.value))}
                >
                  <option value={1}>Nhận biết</option>
                  <option value={2}>Thông hiểu</option>
                  <option value={3}>Vận dụng</option>
                  <option value={4}>Vận dụng cao</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Dạng câu hỏi
                </label>
                <select
                  className="w-full px-4 py-2.5 text-sm font-medium bg-white/80 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500/50"
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                >
                  <option value="SINGLE_CHOICE">Trắc nghiệm một lựa chọn</option>
                  <option value="MULTIPLE_CHOICE">Trắc nghiệm nhiều lựa chọn</option>
                  <option value="TRUE_FALSE">Đúng / Sai</option>
                  <option value="FILL_IN_BLANK">Điền khuyết</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                Gắn Ngữ liệu (Tuỳ chọn)
              </label>
              <div className="flex gap-2 relative">
                {selectedPassageId ? (
                  <div className="flex-1 flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2">
                    <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">{selectedPassagePreview}</span>
                    <button type="button" onClick={() => setSelectedPassageId(null)} className="text-blue-500 hover:text-blue-700 font-bold">X</button>
                  </div>
                ) : (
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <Input 
                      label=""
                      placeholder="Tìm ID hoặc mã ngữ liệu..."
                      className="pl-9"
                      value={passageSearch}
                      onChange={e => setPassageSearch(e.target.value)}
                    />
                    {passageResults.length > 0 && passageSearch && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-auto left-0">
                        <ul className="py-1">
                          {passageResults.map(p => (
                            <li 
                              key={p.id} 
                              className="px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer"
                              onClick={() => {
                                setSelectedPassageId(p.id);
                                setSelectedPassagePreview(p.source_title ? `${p.public_code} - ${p.source_title}` : `${p.public_code}`);
                                setPassageSearch("");
                                setPassageResults([]);
                              }}
                            >
                              <div className="font-medium text-slate-900 dark:text-slate-100">{p.public_code} {p.source_title && `- ${p.source_title}`}</div>
                              <div className="text-xs text-slate-500 truncate">{p.preview}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="glass-card space-y-6">
            <h2 className="text-lg font-bold border-b border-slate-200 pb-2 dark:border-slate-700">2. Nội dung</h2>
            <div className="space-y-4">
              <MarkdownEditor
                value={content}
                onChange={setContent}
                placeholder="Nhập nội dung câu hỏi..."
              />
              <div className="flex justify-end">
                 <Button type="button" variant="outline" size="sm" onClick={handleDuplicateCheck} isLoading={isLoading}>
                    Kiểm tra trùng lặp thủ công
                 </Button>
              </div>
            </div>
          </div>
          
          <div className="glass-card space-y-6">
            <h2 className="text-lg font-bold border-b border-slate-200 pb-2 dark:border-slate-700">3. Đáp án</h2>
            
            {(type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE") && (
              <div className="space-y-4">
                {answers.map((ans, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="pt-3 flex flex-col items-center">
                      <input
                        type={type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                        name="correct_answer"
                        checked={ans.is_correct}
                        onChange={() => setCorrectAnswer(idx, type === "MULTIPLE_CHOICE")}
                        className="w-5 h-5 text-primary-500 focus:ring-primary-500 border-slate-300 cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 uppercase">Đúng</span>
                    </div>
                    <div className="flex-1">
                      <Input
                        label=""
                        placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`}
                        value={ans.content}
                        onChange={(e) => updateAnswer(idx, e.target.value)}
                        required
                      />
                    </div>
                    {answers.length > 2 && (
                      <div className="pt-2">
                        <button type="button" onClick={() => removeAnswer(idx)} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-100 hover:bg-red-50 rounded-lg">
                           <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                
                <div className="pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={addAnswer} className="w-full border-dashed border-2">
                     <Plus className="w-4 h-4 mr-2" /> Thêm đáp án
                  </Button>
                </div>
              </div>
            )}

            {type === "TRUE_FALSE" && (
               <div className="space-y-4">
                 <p className="text-sm text-slate-500 mb-4">Lưu ý: Bạn có thể nhập 4 mệnh đề nhỏ nếu đây là câu Đúng/Sai dạng chùm.</p>
                 {subItems.map((sub, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex-1">
                      <Input
                        label={`Mệnh đề ${sub.label}`}
                        placeholder="Nhập nội dung mệnh đề..."
                        value={sub.prompt || ""}
                        onChange={(e) => {
                          const newSubItems = [...subItems];
                          newSubItems[idx].prompt = e.target.value;
                          setSubItems(newSubItems);
                        }}
                      />
                    </div>
                    <div className="pt-7 flex gap-4">
                       <label className="flex items-center gap-1 cursor-pointer">
                          <input type="radio" checked={sub.answers.find((a:any) => a.content==="Đúng")?.is_correct} onChange={() => {
                             const newSubItems = [...subItems];
                             newSubItems[idx].answers = [{ content: "Đúng", is_correct: true, position: 1 }, { content: "Sai", is_correct: false, position: 2 }];
                             setSubItems(newSubItems);
                          }} className="text-green-500" />
                          <span className="text-sm font-medium text-green-700">Đúng</span>
                       </label>
                       <label className="flex items-center gap-1 cursor-pointer">
                          <input type="radio" checked={sub.answers.find((a:any) => a.content==="Sai")?.is_correct} onChange={() => {
                             const newSubItems = [...subItems];
                             newSubItems[idx].answers = [{ content: "Đúng", is_correct: false, position: 1 }, { content: "Sai", is_correct: true, position: 2 }];
                             setSubItems(newSubItems);
                          }} className="text-red-500" />
                          <span className="text-sm font-medium text-red-700">Sai</span>
                       </label>
                    </div>
                    {subItems.length > 2 && (
                      <div className="pt-7">
                        <button type="button" onClick={() => {
                          const newSubItems = subItems.filter((_, i) => i !== idx);
                          // Re-assign labels (a, b, c, d, ...)
                          newSubItems.forEach((s, i) => { s.label = String.fromCharCode(97 + i); s.position = i + 1; });
                          setSubItems(newSubItems);
                        }} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-100 hover:bg-red-50 rounded-lg">
                           <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <div className="pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                     const nextLabel = String.fromCharCode(97 + subItems.length); // a, b, c, d, e...
                     setSubItems([...subItems, { label: nextLabel, prompt: "", position: subItems.length + 1, point_weight: 0.25, kind: "tf", answers: [{ content: "Đúng", is_correct: true, position: 1 }, { content: "Sai", is_correct: false, position: 2 }] }]);
                  }} className="w-full border-dashed border-2">
                     <Plus className="w-4 h-4 mr-2" /> Thêm mệnh đề
                  </Button>
                </div>
               </div>
            )}

            {type === "FILL_IN_BLANK" && (
               <Input
                 label="Đáp án chính xác"
                 placeholder="Nhập đáp án đúng..."
                 value={fibAnswer}
                 onChange={(e) => setFibAnswer(e.target.value)}
                 required
               />
            )}
          </div>
          
          <div className="glass-card space-y-6">
            <h2 className="text-lg font-bold border-b border-slate-200 pb-2 dark:border-slate-700">4. Nguồn (Tùy chọn)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Tác giả</label>
                <Input
                  label=""
                  placeholder="VD: Bộ GD&ĐT"
                  value={sourceAuthor}
                  onChange={(e) => setSourceAuthor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Đề thi / Tài liệu</label>
                <Input
                  label=""
                  placeholder="VD: Đề minh họa ĐGNL 2024"
                  value={sourceTitle}
                  onChange={(e) => setSourceTitle(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 pb-12 sticky bottom-0 z-20">
            <Button type="submit" isLoading={isLoading} size="lg" className="shadow-lg shadow-primary-500/20 px-12 py-6 text-lg">
              {isEditMode ? "Lưu thay đổi" : "Hoàn tất tạo câu hỏi"}
            </Button>
          </div>
        </form>
      )}

      {/* Duplicate Alert Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Xác nhận"
        message={confirmMessage}
        onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }}
        onCancel={() => { setConfirmOpen(false); setConfirmAction(null); }}
        isDestructive
      />

      <ConfirmDialog
        isOpen={showDuplicateDialog}
        title="Phát hiện trùng lặp"
        message={
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-amber-600 font-medium">
              <AlertCircle className="w-5 h-5" /> Có một số câu hỏi tương tự trong hệ thống.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 p-2 rounded">
              {duplicates.map(d => (
                <div key={d.question_id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-blue-600">ID: #{d.question_id}</span>
                    <span className="text-red-500 font-bold">Giống {(d.similarity_score * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-3">{d.content}</p>
                </div>
              ))}
            </div>
          </div>
        }
        confirmText="Tạo mới bỏ qua cảnh báo"
        cancelText="Đóng"
        onConfirm={() => {
          setShowDuplicateDialog(false);
          submitQuestion();
        }}
        onCancel={() => setShowDuplicateDialog(false)}
      />
    </div>
  );
}
