import { useState, useEffect, useCallback } from "react";
import { getAiReviewQueue, type AiReviewQueueItem } from "../../../api/questions";
import AiReviewModal from "./AiReviewModal";
import { Button } from "../../ui/Button";

const STATUS_TABS = [
    { value: "AI_SUGGESTED", label: "Chờ duyệt" },
    { value: "HUMAN_CONFIRMED", label: "Đã xác nhận" },
    { value: "HUMAN_EDITED", label: "Đã chỉnh sửa" },
    { value: "HUMAN_REJECTED", label: "Đã từ chối" },
];

const PAGE_SIZE = 20;

export default function AiReviewQueueTab() {
    const [items, setItems] = useState<AiReviewQueueItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [statusFilter, setStatusFilter] = useState("AI_SUGGESTED");
    const [loading, setLoading] = useState(true);
    const [reviewQuestionId, setReviewQuestionId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAiReviewQueue(statusFilter, page * PAGE_SIZE, PAGE_SIZE);
            setItems(data.items);
            setTotal(data.total);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [statusFilter, page]);

    useEffect(() => {
        load();
    }, [load]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="space-y-6">
            {/* Status tabs */}
            <div className="flex gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 w-fit">
                {STATUS_TABS.map((t) => (
                    <button
                        key={t.value}
                        onClick={() => {
                            setStatusFilter(t.value);
                            setPage(0);
                        }}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${statusFilter === t.value
                            ? "bg-white dark:bg-slate-900 text-primary-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="overflow-hidden glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Câu hỏi</th>
                                <th className="px-4 py-3 font-semibold">Concepts (AI)</th>
                                <th className="px-4 py-3 font-semibold">Skills (AI)</th>
                                <th className="px-4 py-3 font-semibold text-center">Độ tin cậy</th>
                                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/80 dark:divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                        Đang tải...
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                        Không có bản phân tích nào ở trạng thái này.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors align-top"
                                    >
                                        <td className="px-4 py-3 max-w-md">
                                            <p className="line-clamp-2 text-slate-700 dark:text-slate-300">
                                                {item.question_content || "(Không tìm thấy câu hỏi gốc)"}
                                            </p>
                                            <p className="mt-1 text-[11px] text-slate-400">
                                                Câu #{item.source_question_id ?? "?"} · {item.ai_model_used || "AI"} ·{" "}
                                                {new Date(item.created_at).toLocaleString("vi-VN")}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                            {item.analysis_result?.concepts?.join(", ") || "-"}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                            {item.analysis_result?.skills?.join(", ") || "-"}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {item.confidence !== null ? (
                                                <span className="font-semibold text-primary-600 dark:text-primary-400">
                                                    {Math.round(item.confidence * 100)}%
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {item.source_question_id && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => setReviewQuestionId(item.source_question_id)}
                                                >
                                                    {statusFilter === "AI_SUGGESTED" ? "Duyệt" : "Xem"}
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                        Trước
                    </Button>
                    <span className="text-xs text-slate-500">
                        Trang {page + 1} / {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Sau
                    </Button>
                </div>
            )}

            <AiReviewModal
                isOpen={reviewQuestionId !== null}
                onClose={() => {
                    setReviewQuestionId(null);
                    load(); // refresh queue after review
                }}
                questionId={reviewQuestionId}
            />
        </div>
    );
}
