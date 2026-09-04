import { useState, useEffect, useRef, useCallback } from "react";
import { getExams } from "../../api/exams";
import {
    uploadOmrSheets,
    getOmrJob,
    confirmOmrSheet,
    type OmrJobDetail,
    type OmrSheet,
} from "../../api/omr";
import type { Exam } from "../../types";
import Button from "../../components/ui/Button";
import { ScanLine } from "lucide-react";
import { toast } from '../../components/ui/Toast';

const SHEET_STATUS_STYLES: Record<string, string> = {
    PENDING: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    PROCESSING: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    NEEDS_REVIEW: "bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400",
    COMPLETED: "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400",
    FAILED: "bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400",
};

const SHEET_STATUS_LABELS: Record<string, string> = {
    PENDING: "Chờ xử lý",
    PROCESSING: "Đang xử lý",
    NEEDS_REVIEW: "Cần soát thủ công",
    COMPLETED: "Hoàn tất",
    FAILED: "Lỗi",
};

export default function OmrPage() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [examId, setExamId] = useState<number | "">("");
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [job, setJob] = useState<OmrJobDetail | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        getExams(0, 100)
            .then((data) => setExams(data.items))
            .catch(() => setExams([]));
    }, []);

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const startPolling = useCallback(
        (jobId: number) => {
            stopPolling();
            pollRef.current = setInterval(async () => {
                try {
                    const data = await getOmrJob(jobId);
                    setJob(data);
                    const allDone = data.sheets.every(
                        (s) => s.status !== "PENDING" && s.status !== "PROCESSING"
                    );
                    if (allDone) stopPolling();
                } catch {
                    stopPolling();
                }
            }, 3000);
        },
        [stopPolling]
    );

    useEffect(() => () => stopPolling(), [stopPolling]);

    const handleUpload = async () => {
        if (!examId || files.length === 0) return;
        setUploading(true);
        setUploadError("");
        setJob(null);
        try {
            const res = await uploadOmrSheets(examId as number, files);
            const data = await getOmrJob(res.job_id);
            setJob(data);
            startPolling(res.job_id);
            setFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (err: any) {
            setUploadError(err.response?.data?.detail || err.message || "Lỗi khi upload phiếu.");
        } finally {
            setUploading(false);
        }
    };

    const handleConfirm = async (sheet: OmrSheet) => {
        if (!job) return;
        try {
            await confirmOmrSheet(sheet.id);
            const data = await getOmrJob(job.job.id);
            setJob(data);
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Không thể xác nhận phiếu này.");
        }
    };

    const pendingCount = job?.sheets.filter((s) => s.status === "NEEDS_REVIEW").length ?? 0;

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-gradient flex items-center gap-3 pb-1">
                        <ScanLine className="w-8 h-8 text-primary-500" />
                        Chấm bài (OMR)
                    </h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                        Tải lên ảnh phiếu trả lời trắc nghiệm đã quét/chụp. Hệ thống tự đọc SBD, Mã đề và
                        120 ô đáp án; các phiếu đọc không chắc chắn sẽ được đưa vào hàng chờ soát thủ công.
                    </p>
                </div>
            </div>

            {/* Upload card */}
            <div className="glass-card rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-6 space-y-4">
                <h2 className="text-lg font-bold">1. Tải lên phiếu trả lời</h2>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Kỳ thi</label>
                        <select
                            value={examId}
                            onChange={(e) => setExamId(e.target.value ? Number(e.target.value) : "")}
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            <option value="">-- Chọn kỳ thi --</option>
                            {exams.map((ex) => (
                                <option key={ex.id} value={ex.id}>
                                    #{ex.id} - {ex.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Ảnh phiếu (jpg/png, nhiều file)</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                            className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-700 dark:file:bg-primary-500/10 dark:file:text-primary-400"
                        />
                    </div>
                </div>
                {uploadError && (
                    <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{uploadError}</div>
                )}
                <Button onClick={handleUpload} disabled={!examId || files.length === 0 || uploading}>
                    {uploading ? "Đang tải lên..." : `Tải lên ${files.length || ""} phiếu`}
                </Button>
            </div>

            {/* Job result card */}
            {job && (
                <div className="glass-card rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-6 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h2 className="text-lg font-bold">
                            2. Kết quả xử lý - Job #{job.job.id}
                        </h2>
                        <div className="flex items-center gap-2 text-xs font-semibold">
                            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1">
                                Tổng: {job.sheets.length}
                            </span>
                            {pendingCount > 0 && (
                                <span className="rounded-full bg-warning-50 text-warning-600 px-2.5 py-1">
                                    Cần soát: {pendingCount}
                                </span>
                            )}
                            <span className="rounded-full bg-success-50 text-success-600 px-2.5 py-1">
                                Hoàn tất: {job.sheets.filter((s) => s.status === "COMPLETED").length}
                            </span>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Phiếu</th>
                                    <th className="px-4 py-3 font-semibold">SBD (đọc được)</th>
                                    <th className="px-4 py-3 font-semibold">Mã đề</th>
                                    <th className="px-4 py-3 font-semibold">Trạng thái</th>
                                    <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/80 dark:divide-white/5">
                                {job.sheets.map((s) => (
                                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            {s.image_path ? (
                                                <a
                                                    href={s.image_path}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-primary-600 hover:underline dark:text-primary-400"
                                                >
                                                    Xem ảnh #{s.id}
                                                </a>
                                            ) : (
                                                `#${s.id}`
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs">{s.student_id_raw || "-"}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{s.form_code_raw || "-"}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${SHEET_STATUS_STYLES[s.status] ?? ""}`}>
                                                {SHEET_STATUS_LABELS[s.status] ?? s.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {s.status === "NEEDS_REVIEW" && (
                                                <Button size="sm" onClick={() => handleConfirm(s)}>
                                                    Xác nhận & chấm
                                                </Button>
                                            )}
                                            {s.status === "COMPLETED" && s.exam_submission_id && (
                                                <span className="text-xs text-slate-400">
                                                    Submission #{s.exam_submission_id}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-slate-400">
                        Phiếu "Cần soát" là phiếu hệ thống đọc không chắc chắn (SBD/mã đề nhòe, đáp án
                        nhiễu). Hãy đối chiếu ảnh gốc rồi bấm "Xác nhận & chấm" để tạo bài làm và chấm CTT.
                    </p>
                </div>
            )}
        </div>
    );
}