import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getQuestions,
  deleteQuestion,
  reviewQuestion,
  getQuestionSimilarity,
} from "../../api/questions";
import type { Question, QuestionSimilarityResponse } from "../../types";
import DataTable, { type Column } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  HelpCircle,
  CheckCircle,
  Copy,
  AlertCircle,
  History,
  Sparkles,
} from "lucide-react";
import AiReviewModal from "../../components/admin/question/AiReviewModal";

export default function QuestionsPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [reviewItem, setReviewItem] = useState<Question | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const [similarityItem, setSimilarityItem] = useState<Question | null>(null);
  const [similarQuestions, setSimilarQuestions] = useState<
    QuestionSimilarityResponse[]
  >([]);
  const [isSimLoading, setIsSimLoading] = useState(false);

  const [historyItem, setHistoryItem] = useState<Question | null>(null);
  const [historyList, setHistoryList] = useState<Question[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [aiReviewItem, setAiReviewItem] = useState<Question | null>(null);

  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING">("ALL");
  const [filterLevel, setFilterLevel] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterNode, setFilterNode] = useState<string>("");
  const [filterPassage, setFilterPassage] = useState<string>("");

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const data = await getQuestions(
        0,
        50,
        filterNode ? parseInt(filterNode) : undefined,
        activeTab === "PENDING" ? "PENDING" : undefined,
        filterLevel ? parseInt(filterLevel) : undefined,
        filterType || undefined,
        filterPassage ? filterPassage === "true" : undefined,
      );
      setQuestions(data.items);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [activeTab, filterLevel, filterType, filterNode, filterPassage]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteQuestion(deleteId);
      await fetchQuestions();
    } catch (error) {
      console.error(error);
    } finally {
      setDeleteId(null);
    }
  };

  const handleReview = async (approve: boolean) => {
    if (!reviewItem) return;
    if (!approve && !rejectReason.trim()) {
      setReviewError("Vui lòng nhập lý do từ chối");
      return;
    }
    setReviewError("");
    setIsSubmittingReview(true);
    try {
      await reviewQuestion(
        reviewItem.id,
        approve,
        approve ? undefined : rejectReason,
      );
      setReviewItem(null);
      setRejectReason("");
      await fetchQuestions();
    } catch (error: any) {
      console.error(error);
      setReviewError(
        error.response?.data?.detail || "Có lỗi xảy ra khi duyệt câu hỏi",
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const loadSimilarity = async (q: Question) => {
    setSimilarityItem(q);
    setIsSimLoading(true);
    try {
      const data = await getQuestionSimilarity(q.id);
      setSimilarQuestions(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSimLoading(false);
    }
  };

  const loadHistory = async (q: Question) => {
    setHistoryItem(q);
    setIsHistoryLoading(true);
    try {
      const { getQuestionHistory } = await import("../../api/questions");
      const data = await getQuestionHistory(q.id);
      setHistoryList(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const columns: Column<Question>[] = [
    {
      key: "id",
      header: "ID",
      width: "80px",
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">#{row.id}</span>
      ),
    },
    {
      key: "content",
      header: "Nội dung",
      render: (row) => (
        <div className="flex items-center gap-3 max-w-md">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-500/10">
            <HelpCircle className="h-4 w-4 text-primary-500" />
          </div>
          <div
            className="truncate text-sm font-medium text-slate-900 dark:text-slate-100"
            title={row.content}
          >
            {row.content}
          </div>
        </div>
      ),
    },
    {
      key: "knowledge",
      header: "Chuyên đề",
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {row.knowledge_node?.name || `Node #${row.knowledge_node_id}`}
        </span>
      ),
    },
    {
      key: "level",
      header: "Mức độ",
      render: (row) => {
        const labels: Record<number, string> = {
          1: "Nhận biết",
          2: "Thông hiểu",
          3: "Vận dụng",
          4: "Vận dụng cao",
        };
        const variants: Record<number, any> = {
          1: "info",
          2: "success",
          3: "warning",
          4: "destructive",
        };
        return (
          <Badge variant={variants[row.level] || "secondary"}>
            {labels[row.level] || `Mức ${row.level}`}
          </Badge>
        );
      },
    },
    {
      key: "type",
      header: "Dạng",
      render: (row) => {
        const typeLabels: Record<string, string> = {
          SINGLE_CHOICE: "Trắc nghiệm",
          TRUE_FALSE: "Đúng/Sai",
          FILL_IN_BLANK: "Điền khuyết",
          COMPOSITE: "Câu chùm",
        };
        return (
          <span className="text-xs">{typeLabels[row.type] || row.type}</span>
        );
      },
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (row) => {
        const variants: Record<string, any> = {
          DRAFT: "secondary",
          PENDING: "warning",
          APPROVED: "success",
          REJECTED: "destructive",
        };
        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge variant={variants[row.status] || "secondary"}>
              {row.status}
            </Badge>
            {row.status === "REJECTED" && row.reject_reason && (
              <span
                className="text-[10px] text-danger-500 max-w-[120px] truncate"
                title={row.reject_reason}
              >
                Lý do: {row.reject_reason}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "usage_count",
      header: "Sử dụng",
      render: (row) => (
        <Badge
          variant={
            row.usage_count && row.usage_count > 0 ? "info" : "secondary"
          }
        >
          {row.usage_count || 0} lần
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      width: "180px",
      render: (row) => (
        <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600"
            title="Phân tích AI"
            onClick={() => setAiReviewItem(row)}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary-500 hover:bg-primary-50 hover:text-primary-600"
            title="Duyệt / Từ chối"
            onClick={() => setReviewItem(row)}
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600"
            title="Tìm câu hỏi tương đồng"
            onClick={() => loadSimilarity(row)}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-blue-500 hover:bg-blue-50 hover:text-blue-600"
            title="Lịch sử thay đổi"
            onClick={() => loadHistory(row)}
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Chỉnh sửa"
            onClick={() => navigate(`/admin/questions/${row.id}/edit`)}
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-danger-500 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/10"
            title="Xóa"
            onClick={() => setDeleteId(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">
            Ngân hàng Câu hỏi
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Quản lý và cập nhật câu hỏi cho các kỳ thi
          </p>
        </div>
      </div>

      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-max dark:bg-slate-800">
        <button
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "ALL" ? "bg-white shadow text-slate-900 dark:bg-slate-700 dark:text-white" : "text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"}`}
          onClick={() => setActiveTab("ALL")}
        >
          Tất cả câu hỏi
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "PENDING" ? "bg-white shadow text-slate-900 dark:bg-slate-700 dark:text-white" : "text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"}`}
          onClick={() => setActiveTab("PENDING")}
        >
          Hàng chờ duyệt
        </button>
      </div>

      <div className="glass-card flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm câu hỏi..."
              className="h-11 w-full rounded-xl border border-white/60 bg-white/80 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary-500/50 focus:ring-4 focus:ring-primary-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:focus:border-primary-500/50 backdrop-blur-md shadow-sm"
            />
          </div>
          <div className="shrink-0 flex gap-2 flex-col sm:flex-row">
            <Link to="/admin/questions/new">
              <Button
                size="lg"
                className="w-full sm:w-auto shadow-lg shadow-primary-500/30 hover:-translate-y-0.5"
              >
                <Plus className="mr-2 h-5 w-5" />
                Thêm câu đơn
              </Button>
            </Link>
            <Link to="/admin/questions/new-group">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto hover:-translate-y-0.5 border-primary-500 text-primary-600"
              >
                <Plus className="mr-2 h-5 w-5" />
                Thêm nhóm (Ngữ liệu)
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <select
            className="border border-slate-300 rounded p-2 text-sm"
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
          >
            <option value="">Tất cả mức độ</option>
            <option value="1">Nhận biết</option>
            <option value="2">Thông hiểu</option>
            <option value="3">Vận dụng</option>
            <option value="4">Vận dụng cao</option>
          </select>
          <select
            className="border border-slate-300 rounded p-2 text-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Tất cả dạng</option>
            <option value="SINGLE_CHOICE">Trắc nghiệm</option>
            <option value="TRUE_FALSE">Đúng / Sai</option>
            <option value="FILL_IN_BLANK">Điền khuyết</option>
          </select>
          <select
            className="border border-slate-300 rounded p-2 text-sm"
            value={filterPassage}
            onChange={(e) => setFilterPassage(e.target.value)}
          >
            <option value="">Nguồn ngữ liệu</option>
            <option value="true">Có ngữ liệu (Chùm)</option>
            <option value="false">Câu hỏi độc lập</option>
          </select>
          <div className="col-span-2">
            <input
              type="text"
              placeholder="Filter theo Knowledge Node ID..."
              className="w-full border border-slate-300 rounded p-2 text-sm"
              value={filterNode}
              onChange={(e) => setFilterNode(e.target.value)}
            />
          </div>
        </div>
      </div>

      <DataTable
        data={questions}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyMessage="Chưa có câu hỏi nào trong ngân hàng."
      />

      <AiReviewModal
        isOpen={!!aiReviewItem}
        onClose={() => {
          setAiReviewItem(null);
          fetchQuestions(); // Refresh in case AI review added tags
        }}
        questionId={aiReviewItem?.id || null}
      />

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Xác nhận xóa"
        message={
          <p className="text-slate-500 dark:text-slate-400">
            Bạn có chắc chắn muốn xóa câu hỏi này? Hành động này không thể hoàn
            tác.
          </p>
        }
        isDestructive={true}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* Review Modal */}
      {reviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Duyệt câu hỏi #{reviewItem.id}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Quyết định phê duyệt hoặc từ chối câu hỏi này.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-700 dark:text-slate-300">
                {reviewItem.content}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Lý do từ chối (bắt buộc nếu từ chối)
                </label>
                <textarea
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 outline-none transition-all"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Nhập lý do câu hỏi không đạt yêu cầu..."
                />
                {reviewError && (
                  <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {reviewError}
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setReviewItem(null);
                  setRejectReason("");
                  setReviewError("");
                }}
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleReview(false)}
                disabled={isSubmittingReview}
              >
                Từ chối
              </Button>
              <Button
                className="bg-success-600 hover:bg-success-700 text-white"
                onClick={() => handleReview(true)}
                disabled={isSubmittingReview}
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Phê duyệt
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Similarity Modal */}
      {similarityItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Kiểm tra tương đồng
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Các câu hỏi giống với câu #{similarityItem.id}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setSimilarityItem(null)}>
                Đóng
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Câu hỏi gốc:
                </h4>
                <div className="p-4 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-sm text-slate-700 dark:text-slate-300 border border-primary-100 dark:border-primary-800/50">
                  {similarityItem.content}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  Kết quả tương đồng ({similarQuestions.length}):
                </h4>
                {isSimLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                    Đang phân tích...
                  </div>
                ) : similarQuestions.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-sm text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    Không tìm thấy câu hỏi nào có độ tương đồng cao.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {similarQuestions.map((sim) => (
                      <div
                        key={sim.question_id}
                        className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex flex-col sm:flex-row gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                            {sim.content}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                            <span className="font-mono">
                              #{sim.question_id}
                            </span>
                            <span>•</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {sim.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end justify-center">
                          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                            {(sim.similarity_score * 100).toFixed(1)}%
                          </div>
                          <span className="text-[10px] uppercase tracking-wider text-slate-500">
                            Độ giống
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Lịch sử phiên bản
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Lịch sử thay đổi của câu hỏi #{historyItem.id}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setHistoryItem(null)}>
                Đóng
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
              {isHistoryLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                  Đang tải lịch sử...
                </div>
              ) : historyList.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  Không có lịch sử thay đổi.
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-8 pb-4">
                  {historyList.map((hist) => (
                    <div key={hist.id} className="relative pl-6">
                      <div
                        className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${hist.id === historyItem.id ? "bg-primary-500 ring-4 ring-primary-500/20" : "bg-slate-300 dark:bg-slate-600"}`}
                      ></div>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white text-sm">
                              Phiên bản #{hist.id}
                            </span>
                            {hist.id === historyItem.id && (
                              <Badge variant="info" className="text-[10px]">
                                Hiện tại
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(hist.created_at || "").toLocaleString(
                              "vi-VN",
                            )}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                          {hist.content}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="secondary">{hist.status}</Badge>
                          <span className="text-slate-500">
                            Mức độ: {hist.level}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
