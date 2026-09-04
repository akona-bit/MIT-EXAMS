import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Ban,
  CheckCircle2,
  PlayCircle,
  FileText,
} from "lucide-react";
import { Card } from "../../../components/ui/Card";
import DataTable from "../../../components/ui/DataTable";
import { getExams } from "../../../api/exams";
import {
  getExamParticipants,
  type ExamParticipantRow,
} from "../../../api/admin";
import type { Exam } from "../../../types";

const STATUS_STYLES: Record<string, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  SUBMITTED: "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400",
  SUSPENDED: "bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400",
};

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thi",
  SUBMITTED: "Đã nộp",
  SUSPENDED: "Bị đình chỉ",
};

const PART_NAMES: Record<number, string> = {
  1: "P1 (TV)",
  2: "P2 (TA)",
  3: "P3 (Toán)",
  4: "P4 (TDKH)",
};

export default function StudentManagementPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState<number | "">("");
  const [formFilter, setFormFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sections, setSections] = useState<number[]>([]);
  const [rows, setRows] = useState<ExamParticipantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Danh sách mã đề của kỳ thi đang chọn (để filter) — suy ra từ rows
  const formCodes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.form_code && set.add(r.form_code));
    return Array.from(set).sort();
  }, [rows]);

  const load = useCallback(async () => {
    if (!examId) {
      setRows([]);
      setSections([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const data = await getExamParticipants(examId, {
        form_code: formFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setSections(data.sections);
      setRows(data.items);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [examId, formFilter, statusFilter, search]);

  useEffect(() => {
    getExams(0, 100)
      .then((data) => setExams(data.items))
      .catch(() => setExams([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // KPI
  const kpi = useMemo(() => {
    const submitted = rows.filter((r) => r.status === "SUBMITTED").length;
    const inProgress = rows.filter((r) => r.status === "IN_PROGRESS").length;
    const banned = rows.filter((r) => r.is_banned).length;
    const scored = rows.filter((r) => r.raw_total !== null);
    const avgRaw =
      scored.length > 0
        ? scored.reduce((s, r) => s + (r.raw_total ?? 0), 0) / scored.length
        : 0;
    return { submitted, inProgress, banned, scoredCount: scored.length, avgRaw };
  }, [rows]);

  const columns = useMemo(
    () => {
      const cols: any[] = [
        {
          header: "SBD",
          key: "sbd",
          width: "90px",
          render: (r: ExamParticipantRow) => (
            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
              {r.sbd || "-"}
            </span>
          ),
        },
        {
          header: "Họ và tên",
          key: "full_name",
          render: (r: ExamParticipantRow) => (
            <span className="font-bold text-slate-900 dark:text-white">
              {r.full_name || r.username || "-"}
            </span>
          ),
        },
        {
          header: "Email",
          key: "email",
          render: (r: ExamParticipantRow) => (
            <span className="text-slate-600 dark:text-slate-400">{r.email || "-"}</span>
          ),
        },
        {
          header: "Mã đề",
          key: "form_code",
          width: "80px",
          render: (r: ExamParticipantRow) =>
            r.form_code ? (
              <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 font-mono text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                {r.form_code}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">-</span>
            ),
        },
        {
          header: "Trạng thái",
          key: "status",
          width: "130px",
          render: (r: ExamParticipantRow) => (
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[r.status] ?? ""}`}>
                {STATUS_LABELS[r.status] ?? r.status}
              </span>
              {r.is_banned && (
                <span title="Bị cấm thi" className="text-danger-500">
                  <Ban className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          ),
        },
      ];

      // Cột điểm động theo các phần thực tế của đề
      sections.forEach((part) => {
        cols.push({
          header: `Phần ${part}${PART_NAMES[part] ? ` · ${PART_NAMES[part]}` : ""}`,
          key: `ctt_part${part}`,
          width: "100px",
          render: (r: ExamParticipantRow) => {
            const v = r.ctt_scores?.[`part${part}`];
            return v !== null && v !== undefined ? (
              <span className="font-semibold text-slate-700 dark:text-slate-300">{v}</span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">-</span>
            );
          },
        });
      });

      cols.push(
        {
          header: "Tổng thô",
          key: "raw_total",
          width: "90px",
          render: (r: ExamParticipantRow) =>
            r.raw_total !== null ? (
              <span className="font-bold text-primary-600 dark:text-primary-400">
                {r.raw_total}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">-</span>
            ),
        },
        {
          header: "Điểm thực (IRT)",
          key: "total_score",
          width: "120px",
          render: (r: ExamParticipantRow) =>
            r.total_score !== null && r.score_method === "IRT" ? (
              <span className="font-bold text-primary-600 dark:text-primary-400">
                {r.total_score.toFixed(0)}
              </span>
            ) : (
              <span className="text-xs text-slate-400" title="Chưa đủ điều kiện IRT (N ≥ 200) hoặc chưa chạy">
                {r.score_method === "CTT" ? "CTT" : "-"}
              </span>
            ),
        },
        {
          header: "Nộp lúc",
          key: "submit_time",
          width: "150px",
          render: (r: ExamParticipantRow) =>
            r.submit_time ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(r.submit_time).toLocaleString("vi-VN")}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">-</span>
            ),
        }
      );
      return cols;
    },
    [sections]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient flex items-center gap-3 pb-1">
            <Users className="w-8 h-8 text-primary-500" />
            Quản lý Thí sinh
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Danh sách thí sinh theo từng kỳ thi, đọc trực tiếp từ database — điểm theo phần
            hiển thị động theo cấu trúc đề thực tế của kỳ thi.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Kỳ thi</label>
            <select
              value={examId}
              onChange={(e) => {
                setExamId(e.target.value ? Number(e.target.value) : "");
                setFormFilter("");
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="">-- Chọn kỳ thi --</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  #{ex.id} - {ex.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Mã đề</label>
            <select
              value={formFilter}
              onChange={(e) => setFormFilter(e.target.value)}
              disabled={!examId}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white disabled:opacity-50"
            >
              <option value="">Tất cả mã đề</option>
              {formCodes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              disabled={!examId}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white disabled:opacity-50"
            >
              <option value="">Tất cả</option>
              <option value="NOT_STARTED">Chưa bắt đầu</option>
              <option value="IN_PROGRESS">Đang thi</option>
              <option value="SUBMITTED">Đã nộp</option>
              <option value="SUSPENDED">Bị đình chỉ</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Tìm kiếm</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SBD, tên, email..."
              disabled={!examId}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white disabled:opacity-50"
            />
          </div>
        </div>
      </Card>

      {!examId ? (
        <Card className="p-12 text-center glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60">
          <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400">
            Chọn một kỳ thi ở trên để xem danh sách thí sinh, mã đề và điểm số.
          </p>
        </Card>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center gap-3 border-l-4 border-l-indigo-500 glass-card shadow-lg">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
                <Users className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Tổng thí sinh</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{total}</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3 border-l-4 border-l-success-500 glass-card shadow-lg">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-50 dark:bg-success-500/10">
                <CheckCircle2 className="h-5 w-5 text-success-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Đã nộp</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpi.submitted}</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3 border-l-4 border-l-blue-500 glass-card shadow-lg">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
                <PlayCircle className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Đang thi</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpi.inProgress}</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3 border-l-4 border-l-danger-500 glass-card shadow-lg">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-50 dark:bg-danger-500/10">
                <Ban className="h-5 w-5 text-danger-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Bị cấm / đình chỉ</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpi.banned}</p>
              </div>
            </Card>
          </div>

          {/* Table */}
          <Card className="p-0 overflow-hidden glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Danh sách Thí sinh</h2>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  {sections.length > 0
                    ? `Điểm theo ${sections.length} phần thi: ${sections.map((s) => `P${s}`).join(", ")}`
                    : "Kỳ thi chưa có cấu trúc đề (chưa sinh mã đề)"}
                </p>
              </div>
              {kpi.scoredCount > 0 && (
                <span className="text-xs font-semibold text-slate-500">
                  TB tổng thô: {kpi.avgRaw.toFixed(2)} ({kpi.scoredCount} bài chấm)
                </span>
              )}
            </div>
            <div className="p-6">
              <DataTable
                data={rows}
                columns={columns}
                keyExtractor={(r: ExamParticipantRow) => String(r.participant_id)}
                isLoading={loading}
                emptyMessage={
                  examId
                    ? "Kỳ thi chưa có thí sinh nào (hoặc không khớp bộ lọc)."
                    : "Vui lòng chọn kỳ thi."
                }
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}