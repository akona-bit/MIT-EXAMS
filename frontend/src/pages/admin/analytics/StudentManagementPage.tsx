import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Ban,
  CheckCircle2,
  PlayCircle,
  FileText,
  UserPlus,
  Search,
  Filter,
  GraduationCap,
  ScanLine,
  X,
  Loader2,
  Activity
} from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import DataTable from "../../../components/ui/DataTable";
import { Link, useNavigate } from "react-router-dom";
import { getExams } from "../../../api/exams";
import {
  getExamParticipants,
  type ExamParticipantRow,
} from "../../../api/admin";
import type { Exam } from "../../../types";
import AssignStudentsModal from "../../../components/admin/AssignStudentsModal";
import { PageTransition } from "../../../components/ui/PageTransition";
import { gradeOmrSubmission } from "../../../api/submissions";
import { toast } from "../../../components/ui/Toast";

const STATUS_STYLES: Record<string, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50",
  SUBMITTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50",
  SUSPENDED: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50",
};

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thi",
  SUBMITTED: "Đã nộp",
  SUSPENDED: "Đình chỉ",
};

const PART_NAMES: Record<number, string> = {
  1: "P1 (TV)",
  2: "P2 (TA)",
  3: "P3 (Toán)",
  4: "P4 (TDKH)",
};

export default function StudentManagementPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState<number | "">("");
  const [formFilter, setFormFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sections, setSections] = useState<number[]>([]);
  const [rows, setRows] = useState<ExamParticipantRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedOmrSubmission, setSelectedOmrSubmission] = useState<ExamParticipantRow | null>(null);
  const [isGrading, setIsGrading] = useState(false);

  // Extract form codes from rows
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
      setSelectedRows(new Set());
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

  const handleGradeOmr = async () => {
    if (!selectedOmrSubmission || !selectedOmrSubmission.submission_id) return;
    setIsGrading(true);
    try {
      const res = await gradeOmrSubmission(selectedOmrSubmission.submission_id);
      toast.success(res.message);
      setTimeout(() => {
        load();
        setSelectedOmrSubmission(null);
      }, 3000);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Lỗi khi chấm điểm OMR");
    } finally {
      setIsGrading(false);
    }
  };

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
          header: (
            <input
              type="checkbox"
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
              checked={rows.length > 0 && selectedRows.size === rows.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedRows(new Set(rows.map((r) => r.participant_id)));
                } else {
                  setSelectedRows(new Set());
                }
              }}
            />
          ),
          key: "checkbox",
          width: "40px",
          fixed: true,
          render: (r: ExamParticipantRow) => (
            <input
              type="checkbox"
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
              checked={selectedRows.has(r.participant_id)}
              onChange={(e) => {
                const newSet = new Set(selectedRows);
                if (e.target.checked) {
                  newSet.add(r.participant_id);
                } else {
                  newSet.delete(r.participant_id);
                }
                setSelectedRows(newSet);
              }}
            />
          ),
        },
        {
          header: "Thí sinh",
          key: "student",
          fixed: true,
          render: (r: ExamParticipantRow) => (
            <div>
              <div className="font-bold text-slate-900 dark:text-white">
                {r.full_name || r.username || "-"}
              </div>
              <div className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                SBD: <span className="text-slate-700 dark:text-slate-300">{r.sbd || "-"}</span>
              </div>
            </div>
          ),
        },
        {
          header: "Email",
          key: "email",
          render: (r: ExamParticipantRow) => (
            <span className="text-slate-600 dark:text-slate-400 font-medium">{r.email || "-"}</span>
          ),
        },
        {
          header: "Mã đề",
          key: "form_code",
          width: "80px",
          render: (r: ExamParticipantRow) =>
            r.form_code ? (
              <span className="inline-flex items-center justify-center rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {r.form_code}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">-</span>
            ),
        },
        {
          header: "Trạng thái",
          key: "status",
          width: "120px",
          render: (r: ExamParticipantRow) => (
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center justify-center rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${STATUS_STYLES[r.status] ?? ""}`}>
                {STATUS_LABELS[r.status] ?? r.status}
              </span>
              {r.is_banned && (
                <span title="Bị cấm thi" className="text-rose-500 bg-rose-50 dark:bg-rose-900/30 p-1 rounded-md">
                  <Ban className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          ),
        },
      ];

      // Dynamic part scores
      sections.forEach((part) => {
        cols.push({
          header: `P${part}${PART_NAMES[part] ? ` ${PART_NAMES[part].replace(/P\d+ /, '')}` : ""}`,
          key: `ctt_part${part}`,
          width: "90px",
          render: (r: ExamParticipantRow) => {
            const v = r.ctt_scores?.[`part${part}`];
            return v !== null && v !== undefined ? (
              <span className="font-bold text-slate-700 dark:text-slate-200">{v}</span>
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
              <span className="font-black text-primary-600 dark:text-primary-400">
                {r.raw_total}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">-</span>
            ),
        },
        {
          header: "Điểm IRT",
          key: "total_score",
          width: "100px",
          render: (r: ExamParticipantRow) =>
            r.total_score !== null && r.score_method === "IRT" ? (
              <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md">
                {r.total_score.toFixed(0)}
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md" title="Chưa đủ điều kiện IRT (N ≥ 200) hoặc chưa chạy">
                {r.score_method === "CTT" ? "CTT" : "N/A"}
              </span>
            ),
        },
        {
          header: "Hành động",
          key: "action",
          width: "140px",
          render: (r: ExamParticipantRow) => (
            <div className="flex items-center gap-2">
              <Link
                to={`/admin/students/${r.user_id}`}
                className="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-md hover:bg-primary-100 dark:hover:bg-primary-900/40 inline-block"
              >
                Hồ sơ
              </Link>
              {r.omr_image_url && (
                <button
                  onClick={() => setSelectedOmrSubmission(r)}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/40 inline-block"
                  title="Chấm OMR tự động"
                >
                  <ScanLine className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ),
        }
      );
      return cols;
    },
    [sections, selectedRows, rows]
  );

  const renderHeader = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b pb-4 border-slate-200 dark:border-slate-800">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3 pb-1">
          <GraduationCap className="w-8 h-8 text-primary-500" />
          Quản lý Bài làm & Thí sinh
        </h1>
        <p className="text-base text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
          Quản lý danh sách thí sinh, giám sát quá trình làm bài và theo dõi kết quả thi chi tiết.
        </p>
      </div>
      <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#0f172a] p-2 rounded-xl border border-slate-200 dark:border-slate-800">
        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 pl-2">Kỳ thi:</label>
        <select
          value={examId}
          onChange={(e) => {
            setExamId(e.target.value ? Number(e.target.value) : "");
            setFormFilter("");
          }}
          className="rounded-lg border-0 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 shadow-sm outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer min-w-[240px]"
        >
          <option value="">-- Chọn kỳ thi để quản lý --</option>
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              #{ex.id} - {ex.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  if (!examId) {
    return (
      <PageTransition className="space-y-6 max-w-[1400px] mx-auto pb-12">
        {renderHeader()}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-16 text-center shadow-sm">
          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-slate-400 dark:text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Chưa chọn kỳ thi</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Vui lòng chọn một kỳ thi từ trình đơn thả xuống ở góc trên bên phải để bắt đầu quản lý danh sách thí sinh và điểm số.
          </p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-6 max-w-[1400px] mx-auto pb-12">
      {renderHeader()}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 border-l-4 border-l-indigo-500 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng thí sinh</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-2">{total}</h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
              <Users size={28} />
            </div>
          </div>
        </Card>
        
        <Card className="p-6 border-l-4 border-l-emerald-500 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đã nộp bài</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-2">{kpi.submitted}</h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={28} />
            </div>
          </div>
        </Card>
        
        <Card className="p-6 border-l-4 border-l-blue-500 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đang thi</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-2">{kpi.inProgress}</h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400">
              <PlayCircle size={28} />
            </div>
          </div>
        </Card>
        
        <Card className="p-6 border-l-4 border-l-rose-500 bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đình chỉ</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-2">{kpi.banned}</h3>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400">
              <Ban size={28} />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Area */}
      <Card className="bg-white dark:bg-[#0b1120] shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col">
        {/* Action & Filter Bar */}
        <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-[320px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo Tên, SBD, Email..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all shadow-sm"
                />
              </div>
              <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 hidden md:block mx-1"></div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  value={formFilter}
                  onChange={(e) => setFormFilter(e.target.value)}
                  className="pl-9 pr-8 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 appearance-none shadow-sm cursor-pointer min-w-[140px]"
                >
                  <option value="">Mọi mã đề</option>
                  {formCodes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 shadow-sm cursor-pointer min-w-[160px]"
                >
                  <option value="">Mọi trạng thái</option>
                  <option value="NOT_STARTED">Chưa bắt đầu</option>
                  <option value="IN_PROGRESS">Đang thi</option>
                  <option value="SUBMITTED">Đã nộp</option>
                  <option value="SUSPENDED">Đình chỉ</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 ml-auto">
              {kpi.scoredCount > 0 && (
                <div className="hidden lg:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Điểm trung bình (Thô):</span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-200">{kpi.avgRaw.toFixed(1)}</span>
                </div>
              )}
              <Button
                variant="outline"
                disabled={selectedRows.size < 2}
                onClick={() => {
                  const pids = Array.from(selectedRows).join(",");
                  navigate(`/admin/students/compare?exam_id=${examId}&pids=${pids}`);
                }}
                className="gap-2 h-10 px-5 rounded-xl font-bold shadow-sm border-slate-300 dark:border-slate-700"
              >
                <Activity className="w-4 h-4" />
                So sánh đã chọn ({selectedRows.size})
              </Button>
              <Button
                variant="primary"
                onClick={() => setIsAssignModalOpen(true)}
                className="gap-2 h-10 px-5 rounded-xl font-bold shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                Giao Đề Cho Thí Sinh
              </Button>
            </div>
          </div>
        </div>
        
        {/* Table Content */}
        <div className="p-4 md:p-6 overflow-x-auto">
          <DataTable
            data={rows}
            columns={columns}
            keyExtractor={(r: ExamParticipantRow) => String(r.participant_id)}
            isLoading={loading}
            compact={false}
            emptyMessage={
              search || formFilter || statusFilter
                ? "Không tìm thấy thí sinh nào khớp với bộ lọc hiện tại."
                : "Chưa có thí sinh nào được giao đề cho kỳ thi này."
            }
          />
        </div>
      </Card>

      <AssignStudentsModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        examId={examId as number}
        onSuccess={load}
      />

      {/* Grade OMR Modal */}
      {selectedOmrSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-primary-500" />
                Chấm điểm OMR tự động
              </h2>
              <button 
                onClick={() => !isGrading && setSelectedOmrSubmission(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors disabled:opacity-50"
                disabled={isGrading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-100 dark:bg-[#0b1120] flex-1">
              <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                <p><strong>Thí sinh:</strong> {selectedOmrSubmission.full_name || selectedOmrSubmission.username} ({selectedOmrSubmission.sbd})</p>
                <p><strong>Mã đề:</strong> {selectedOmrSubmission.form_code || "-"}</p>
                <p className="mt-2">Ảnh chụp bài làm OMR:</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-700 aspect-auto min-h-[300px] flex items-center justify-center">
                <img 
                  src={selectedOmrSubmission.omr_image_url || undefined} 
                  alt="OMR Sheet" 
                  className="max-w-full max-h-[500px] object-contain"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedOmrSubmission(null)} disabled={isGrading}>
                Hủy
              </Button>
              <Button onClick={handleGradeOmr} disabled={isGrading} className="min-w-[140px]">
                {isGrading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <ScanLine className="w-4 h-4 mr-2" />
                    Chấm ngay
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}