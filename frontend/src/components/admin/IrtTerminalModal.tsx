import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import {
  CheckCircle2,
  Circle,
  Loader2,
  Terminal,
  Database,
  Clock,
  ListChecks,
} from 'lucide-react';

interface IrtLog {
  time: string;
  msg: string;
}

interface IrtTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: string | null;
  logs: IrtLog[];
}

// 8 milestone khớp chính xác với các dòng log backend phát ra (scorer.py),
// theo đúng thứ tự thực thi — dùng để tính % tiến độ và step timeline.
const MILESTONES: { label: string; match: (msg: string) => boolean }[] = [
  { label: 'Khởi tạo tiến trình', match: (m) => m.includes('Bắt đầu tiến trình') },
  { label: 'Tải câu hỏi từ đề thi', match: (m) => m.includes('Đã tải') && m.includes('câu hỏi') },
  { label: 'Trích xuất bài làm', match: (m) => m.includes('Tìm thấy') && m.includes('bài làm') },
  { label: 'Ước lượng tham số (MMLE)', match: (m) => m.includes('MMLE thành công') },
  { label: 'Ghi tham số vào ngân hàng câu hỏi', match: (m) => m.includes('Đã cập nhật tham số') },
  { label: 'Quy đổi điểm chuẩn (True Score)', match: (m) => m.includes('Đã cập nhật điểm chuẩn') },
  { label: 'Phân tích CTT & Chi-Square', match: (m) => m.includes('Đã lưu') && m.includes('phân tích') },
  { label: 'Hoàn tất', match: (m) => m.includes('Hoàn tất quá trình IRT') },
];

const STATUS_META: Record<string, { label: string; cls: string; pulse?: boolean }> = {
  PENDING: { label: 'Đang khởi tạo', cls: 'bg-warning-500/10 text-warning-500 border-warning-500/30', pulse: true },
  STARTED: { label: 'Đang chạy', cls: 'bg-info-500/10 text-info-500 border-info-500/30', pulse: true },
  SUCCESS: { label: 'Hoàn tất', cls: 'bg-success-500/10 text-success-500 border-success-500/30' },
  FAILED: { label: 'Thất bại', cls: 'bg-danger-500/10 text-danger-500 border-danger-500/30' },
};

function classifyLog(msg: string): 'error' | 'success' | 'active' | 'default' {
  const lower = msg.toLowerCase();
  if (lower.includes('lỗi') || lower.includes('fail')) return 'error';
  if (lower.includes('hoàn tất') || lower.includes('thành công') || lower.includes('đã cập nhật') || lower.includes('đã lưu') || lower.includes('đã tải'))
    return 'success';
  if (lower.startsWith('đang ') || lower.includes('bắt đầu')) return 'active';
  return 'default';
}

const LOG_COLOR: Record<string, string> = {
  error: 'text-red-400',
  success: 'text-green-400',
  active: 'text-sky-300',
  default: 'text-emerald-300',
};

function fmtDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function IrtTerminalModal({ isOpen, onClose, status, logs }: IrtTerminalModalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const isComplete = status === 'SUCCESS' || status === 'FAILED';
  const isRunning = status === 'PENDING' || status === 'STARTED';

  // Đồng hồ elapsed — tick mỗi giây khi đang chạy
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  // Auto-scroll terminal xuống cuối khi có log mới
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Milestone đã đạt — dùng cho progress % và step timeline
  const matchedCount = useMemo(
    () => MILESTONES.filter((ms) => logs.some((l) => ms.match(l.msg))).length,
    [logs]
  );
  const percent = status === 'SUCCESS' ? 100 : Math.round((matchedCount / MILESTONES.length) * 100);
  const currentStepLabel =
    matchedCount >= MILESTONES.length
      ? 'Hoàn tất'
      : MILESTONES[matchedCount]?.label ?? 'Đang khởi tạo...';

  // Số liệu thật parse từ log
  const stats = useMemo(() => {
    const find = (re: RegExp): string | null => {
      for (const l of logs) {
        const m = l.msg.match(re);
        if (m) return m[1];
      }
      return null;
    };
    return {
      questions: find(/tải (\d+) câu hỏi/),
      submissions: find(/Tìm thấy (\d+) bài làm/),
      items: find(/lưu (\d+) kết quả/),
    };
  }, [logs]);

  const elapsed = useMemo(() => {
    if (logs.length === 0) return null;
    const start = new Date(logs[0].time).getTime();
    if (Number.isNaN(start)) return null;
    const end = isComplete ? new Date(logs[logs.length - 1].time).getTime() : nowTick;
    if (Number.isNaN(end)) return null;
    return Math.max(0, Math.round((end - start) / 1000));
  }, [logs, nowTick, isComplete]);

  const statusMeta = status ? STATUS_META[status] : undefined;

  // Artifacts đã ghi (khớp milestone tương ứng)
  const artifacts = [
    {
      name: 'Bảng Question',
      desc: 'Tham số độ khó (b) & độ phân biệt (a)',
      ready: matchedCount >= 5,
    },
    {
      name: 'Bảng ExamResult',
      desc: 'Điểm chuẩn True Score theo thí sinh',
      ready: matchedCount >= 6,
    },
    {
      name: 'Bảng ItemAnalysisResult',
      desc: 'CTT (Difficulty, Discrimination) & IRT (SE, Chi²)',
      ready: matchedCount >= 7,
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-5xl">
      <div className="flex flex-col h-[72vh] bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 shadow-2xl -m-2">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
              <Terminal className="w-4 h-4 text-primary-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-neutral-100 truncate">
                Tiến trình phân tích IRT
              </h3>
              <p className="text-xs text-neutral-500 font-mono">
                {statusMeta ? statusMeta.label : 'Chờ trạng thái...'}
                {elapsed !== null && (
                  <span className="inline-flex items-center gap-1 ml-2 text-neutral-400">
                    <Clock className="w-3 h-3" />
                    {fmtDuration(elapsed)}
                  </span>
                )}
              </p>
            </div>
          </div>
          {statusMeta && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0 ${statusMeta.cls}`}
            >
              {statusMeta.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
              {statusMeta.label}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-3.5 pb-3 bg-neutral-900/50 border-b border-neutral-800 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-neutral-400 flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5" />
              {isComplete && status === 'SUCCESS' ? 'Hoàn tất toàn bộ quy trình' : `Đang thực hiện: ${currentStepLabel}`}
            </span>
            <span className="text-xs font-mono font-semibold text-primary-400">{percent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                status === 'FAILED' ? 'bg-danger-500' : 'bg-primary-500'
              }`}
              style={{ width: `${Math.max(percent, 3)}%` }}
            />
          </div>
        </div>

        {/* Body: terminal trái + step/artifacts phải */}
        <div className="flex flex-1 overflow-hidden">

          {/* Terminal */}
          <div className="flex-1 bg-black p-4 overflow-y-auto font-mono text-sm leading-relaxed min-w-0" ref={terminalRef}>
            {logs.length === 0 ? (
              <div className="text-neutral-500 italic flex items-center gap-2">
                {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-500" />}
                Đang khởi tạo tiến trình nền...
              </div>
            ) : (
              logs.map((log, index) => {
                const kind = classifyLog(log.msg);
                return (
                  <div key={index} className="mb-1 flex">
                    <span className="text-neutral-600 w-20 shrink-0 select-none">
                      {new Date(log.time).toLocaleTimeString('vi-VN', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <span className={`flex-1 ${LOG_COLOR[kind]}`}>{log.msg}</span>
                  </div>
                );
              })
            )}

            {!isComplete && (
              <div className="mt-2 flex items-center">
                <span className="text-neutral-600 w-20 shrink-0">--:--:--</span>
                <span className="w-2 h-4 bg-emerald-300 inline-block animate-pulse" />
              </div>
            )}
          </div>

          {/* Right panel: steps + stats + artifacts */}
          <div className="w-80 shrink-0 bg-neutral-900/60 border-l border-neutral-800 p-4 overflow-y-auto flex flex-col gap-5">

            {/* Step timeline */}
            <div>
              <h4 className="text-neutral-400 font-semibold mb-3 text-xs uppercase tracking-wider">
                Các bước thực hiện
              </h4>
              <div className="space-y-2.5">
                {MILESTONES.map((ms, i) => {
                  const done = i < matchedCount;
                  const active = i === matchedCount && isRunning;
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-success-500 shrink-0 mt-0.5" />
                      ) : active ? (
                        <Loader2 className="w-4 h-4 text-info-500 shrink-0 mt-0.5 animate-spin" />
                      ) : (
                        <Circle className="w-4 h-4 text-neutral-700 shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-xs leading-5 ${
                          done
                            ? 'text-neutral-200'
                            : active
                              ? 'text-info-400 font-medium'
                              : 'text-neutral-600'
                        }`}
                      >
                        {ms.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats từ log thật */}
            {(stats.questions || stats.submissions || stats.items) && (
              <div>
                <h4 className="text-neutral-400 font-semibold mb-3 text-xs uppercase tracking-wider">
                  Số liệu
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {stats.questions && (
                    <div className="rounded-lg bg-neutral-800/70 border border-neutral-800 p-2 text-center">
                      <div className="text-lg font-bold text-neutral-100 font-mono">{stats.questions}</div>
                      <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Câu hỏi</div>
                    </div>
                  )}
                  {stats.submissions && (
                    <div className="rounded-lg bg-neutral-800/70 border border-neutral-800 p-2 text-center">
                      <div className="text-lg font-bold text-neutral-100 font-mono">{stats.submissions}</div>
                      <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Bài làm</div>
                    </div>
                  )}
                  {stats.items && (
                    <div className="rounded-lg bg-neutral-800/70 border border-neutral-800 p-2 text-center">
                      <div className="text-lg font-bold text-neutral-100 font-mono">{stats.items}</div>
                      <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Item</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Artifacts */}
            <div>
              <h4 className="text-neutral-400 font-semibold mb-3 text-xs uppercase tracking-wider">
                Dữ liệu ghi xuống
              </h4>
              <div className="space-y-2">
                {artifacts.map((a) => (
                  <div
                    key={a.name}
                    className={`rounded-lg border p-2.5 flex items-start gap-2.5 transition-colors ${
                      a.ready
                        ? 'bg-success-500/5 border-success-500/20'
                        : 'bg-neutral-800/40 border-neutral-800'
                    }`}
                  >
                    <Database className={`w-4 h-4 shrink-0 mt-0.5 ${a.ready ? 'text-success-500' : 'text-neutral-600'}`} />
                    <div className="min-w-0">
                      <div className={`text-xs font-medium flex items-center gap-1.5 ${a.ready ? 'text-neutral-100' : 'text-neutral-500'}`}>
                        {a.name}
                        {a.ready && <CheckCircle2 className="w-3 h-3 text-success-500" />}
                      </div>
                      <div className="text-[11px] text-neutral-500 leading-4 mt-0.5">{a.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Kết quả */}
            {status === 'SUCCESS' && (
              <div className="mt-auto">
                <div className="p-3 bg-success-500/10 border border-success-500/25 rounded-lg text-success-500 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Toàn bộ dữ liệu đã được ghi vào hệ thống. Điểm IRT giờ là điểm chính thức của kỳ thi.</span>
                </div>
              </div>
            )}

            {status === 'FAILED' && (
              <div className="mt-auto">
                <div className="p-3 bg-danger-500/10 border border-danger-500/25 rounded-lg text-danger-500 text-xs flex items-start gap-2">
                  <Circle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Quá trình phân tích thất bại. Điểm tạm thời vẫn theo CTT — có thể chạy lại IRT.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
