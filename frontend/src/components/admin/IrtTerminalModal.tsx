import { useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

interface IrtTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: string | null;
  logs: { time: string; msg: string }[];
}

export default function IrtTerminalModal({ isOpen, onClose, status, logs }: IrtTerminalModalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom of terminal
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const isComplete = status === 'SUCCESS' || status === 'FAILED';

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
      <div className="flex flex-col h-[70vh] bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <h3 className="text-sm font-medium text-slate-300">
              Tiến trình phân tích IRT
              {status && <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-700 text-xs text-white">{status}</span>}
            </h3>
          </div>
          {isComplete && (
            <Button variant="outline" size="sm" onClick={onClose} className="text-slate-300 border-slate-600 hover:bg-slate-700">
              Đóng
            </Button>
          )}
        </div>

        {/* Content - Split Pane */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Terminal / Logs Left Side */}
          <div className="flex-1 bg-black p-4 overflow-y-auto font-mono text-sm leading-relaxed" ref={terminalRef}>
            {logs.length === 0 ? (
              <div className="text-slate-500 italic">Đang khởi tạo tiến trình nền (background task)...</div>
            ) : (
              logs.map((log, index) => {
                const isError = log.msg.toLowerCase().includes('lỗi') || log.msg.toLowerCase().includes('fail');
                const isSuccess = log.msg.toLowerCase().includes('hoàn tất') || log.msg.toLowerCase().includes('thành công');
                
                return (
                  <div key={index} className="mb-1 flex">
                    <span className="text-slate-500 w-24 shrink-0">
                      {new Date(log.time).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className={`flex-1 ${isError ? 'text-red-400' : isSuccess ? 'text-green-400' : 'text-emerald-300'}`}>
                      {log.msg}
                    </span>
                  </div>
                );
              })
            )}
            
            {!isComplete && (
              <div className="mt-2 flex items-center">
                <span className="text-slate-500 w-24 shrink-0">--:--:--</span>
                <span className="text-emerald-300 flex items-center">
                  <span className="w-2 h-4 bg-emerald-300 inline-block animate-pulse"></span>
                </span>
              </div>
            )}
          </div>

          {/* Storage / Artifacts Right Side */}
          <div className="w-1/3 bg-slate-800/50 border-l border-slate-700 p-4 overflow-y-auto flex flex-col">
            <h4 className="text-slate-200 font-semibold mb-4 text-sm uppercase tracking-wider">Lưu trữ (Artifacts)</h4>
            
            <div className="space-y-4">
              <div className="bg-slate-800 rounded p-3 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">Cơ sở dữ liệu</div>
                <div className="text-sm text-slate-200 font-medium">Bảng Question</div>
                <div className="text-xs text-slate-500 mt-1">
                  Tham số độ khó (b) & độ phân biệt (a) của {logs.some(l => l.msg.includes('MMLE thành công')) ? 'các câu hỏi' : '...'}
                </div>
              </div>

              <div className="bg-slate-800 rounded p-3 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">Cơ sở dữ liệu</div>
                <div className="text-sm text-slate-200 font-medium">Bảng ExamResult</div>
                <div className="text-xs text-slate-500 mt-1">
                  Năng lực Theta (θ) & Điểm chuẩn True Score của {logs.some(l => l.msg.includes('Theta')) ? 'tất cả thí sinh' : '...'}
                </div>
              </div>

              <div className="bg-slate-800 rounded p-3 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">Cơ sở dữ liệu</div>
                <div className="text-sm text-slate-200 font-medium">Bảng ItemAnalysisResult</div>
                <div className="text-xs text-slate-500 mt-1">
                  Chỉ số CTT (Difficulty, Discrimination) & Chỉ số IRT (SE, Chi-Square Fit)
                </div>
              </div>
            </div>

            {status === 'SUCCESS' && (
              <div className="mt-auto pt-6">
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
                  ✓ Toàn bộ dữ liệu đã được ghi vào hệ thống lưu trữ an toàn.
                </div>
              </div>
            )}
            
            {status === 'FAILED' && (
              <div className="mt-auto pt-6">
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  ✗ Quá trình phân tích thất bại, dữ liệu có thể bị hủy bỏ.
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </Modal>
  );
}
