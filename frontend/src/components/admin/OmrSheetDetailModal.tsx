import { useState, useEffect, useCallback } from "react";
import { getOmrSheet, confirmOmrSheet, type OmrSheetDetail } from "../../api/omr";
import Button from "../ui/Button";
import { X, CheckCircle, AlertTriangle, Eye } from "lucide-react";

interface OmrSheetDetailModalProps {
    sheetId: number | null;
    onClose: () => void;
    onConfirmed: () => void;
}

const LETTERS = ["A", "B", "C", "D"];
const QUESTIONS_PER_PAGE = 24;

export default function OmrSheetDetailModal({ sheetId, onClose, onConfirmed }: OmrSheetDetailModalProps) {
    const [sheet, setSheet] = useState<OmrSheetDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [confirming, setConfirming] = useState(false);
    const [page, setPage] = useState(0);

    useEffect(() => {
        if (!sheetId) return;
        setLoading(true);
        getOmrSheet(sheetId)
            .then((data) => {
                setSheet(data);
                setAnswers(data.answers || {});
            })
            .catch(() => onClose())
            .finally(() => setLoading(false));
    }, [sheetId]);

    const handleAnswerChange = useCallback((questionNo: number, letter: string | null) => {
        setAnswers((prev) => {
            const next = { ...prev };
            if (letter === null) {
                delete next[String(questionNo)];
            } else {
                next[String(questionNo)] = letter;
            }
            return next;
        });
    }, []);

    const handleConfirm = async () => {
        if (!sheet) return;
        setConfirming(true);
        try {
            const override: Record<number, string | null> = {};
            for (const [k, v] of Object.entries(answers)) {
                override[Number(k)] = v;
            }
            await confirmOmrSheet(sheet.id, override);
            onConfirmed();
        } catch {
        } finally {
            setConfirming(false);
        }
    };

    if (!sheetId) return null;

    const totalPages = Math.ceil(120 / QUESTIONS_PER_PAGE);
    const startQ = page * QUESTIONS_PER_PAGE + 1;
    const endQ = Math.min((page + 1) * QUESTIONS_PER_PAGE, 120);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <Eye className="w-5 h-5 text-primary-500" />
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            Chi tiết phiếu #{sheetId}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : sheet ? (
                    <div className="flex flex-col lg:flex-row overflow-hidden" style={{ maxHeight: "calc(90vh - 64px)" }}>
                        {/* Left: Image + Info */}
                        <div className="lg:w-2/5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
                            {/* Image */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-950">
                                {sheet.image_path ? (
                                    <img
                                        src={sheet.image_path}
                                        alt={`Phiếu #${sheet.id}`}
                                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 object-contain max-h-64"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                                        Không có ảnh
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-slate-500 dark:text-slate-400">SBD:</span>
                                        <p className="font-mono font-bold text-slate-900 dark:text-white">{sheet.student_id_raw || "—"}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 dark:text-slate-400">Mã đề:</span>
                                        <p className="font-mono font-bold text-slate-900 dark:text-white">{sheet.form_code_raw || "—"}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 dark:text-slate-400">Confidence:</span>
                                        <p className={`font-bold ${sheet.confidence_score && sheet.confidence_score > 0.8 ? "text-green-600" : sheet.confidence_score && sheet.confidence_score > 0.5 ? "text-amber-600" : "text-red-600"}`}>
                                            {sheet.confidence_score ? `${(sheet.confidence_score * 100).toFixed(1)}%` : "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 dark:text-slate-400">Trạng thái:</span>
                                        <p className="font-semibold">{sheet.status}</p>
                                    </div>
                                </div>
                                {sheet.error_message && (
                                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        {sheet.error_message}
                                    </div>
                                )}
                                <div className="text-xs text-slate-400">
                                    Đã đọc: {Object.keys(answers).length}/120 câu
                                </div>
                            </div>
                        </div>

                        {/* Right: Answer Grid */}
                        <div className="lg:w-3/5 flex flex-col overflow-hidden">
                            {/* Page tabs */}
                            <div className="flex items-center gap-1 px-4 pt-4 overflow-x-auto">
                                {Array.from({ length: totalPages }, (_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setPage(i)}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                            page === i
                                                ? "bg-primary-500 text-white"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                        }`}
                                    >
                                        {i * QUESTIONS_PER_PAGE + 1}-{Math.min((i + 1) * QUESTIONS_PER_PAGE, 120)}
                                    </button>
                                ))}
                            </div>

                            {/* Answer table */}
                            <div className="flex-1 overflow-y-auto p-4">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-slate-500 dark:text-slate-400 text-xs uppercase">
                                            <th className="text-left py-2 w-12">#</th>
                                            {LETTERS.map((l) => (
                                                <th key={l} className="text-center py-2 w-16">{l}</th>
                                            ))}
                                            <th className="text-center py-2 w-16 text-slate-400">Đã đọc</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {Array.from({ length: endQ - startQ + 1 }, (_, i) => {
                                            const qNo = startQ + i;
                                            const currentAnswer = answers[String(qNo)] || null;
                                            return (
                                                <tr key={qNo} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                    <td className="py-1.5 font-mono text-xs text-slate-500">{qNo}</td>
                                                    {LETTERS.map((l) => (
                                                        <td key={l} className="text-center py-1.5">
                                                            <button
                                                                onClick={() => handleAnswerChange(qNo, currentAnswer === l ? null : l)}
                                                                className={`w-8 h-8 rounded-full border-2 text-xs font-bold transition-all ${
                                                                    currentAnswer === l
                                                                        ? "bg-primary-500 border-primary-500 text-white shadow-md"
                                                                        : "border-slate-300 dark:border-slate-600 text-slate-400 hover:border-primary-400"
                                                                }`}
                                                            >
                                                                {l}
                                                            </button>
                                                        </td>
                                                    ))}
                                                    <td className="text-center">
                                                        {currentAnswer && (
                                                            <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                                <span className="text-sm text-slate-500">
                                    Đã chọn: {Object.keys(answers).length}/120
                                </span>
                                <div className="flex items-center gap-3">
                                    <Button variant="outline" onClick={onClose}>Hủy</Button>
                                    <Button onClick={handleConfirm} disabled={confirming || sheet.status !== "NEEDS_REVIEW"}>
                                        {confirming ? "Đang chấm..." : "Xác nhận & chấm"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
