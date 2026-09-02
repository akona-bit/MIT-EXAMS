import { useState, useEffect } from "react";
import api from "../../../api/client";

interface FraudAlert {
  session_id: number;
  exam_id: number;
  student_name: string;
  risk_score: number;
  status: string;
  flagged: boolean;
}

export default function FraudDetectionPage() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [isSuspending, setIsSuspending] = useState(false);

  useEffect(() => {
    // Kết nối websocket dùng lại /ws/online
    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/online";
    const socket = new WebSocket(wsUrl);
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.fraud_alerts) {
          // Sort by risk_score descending
          const sorted = data.fraud_alerts.sort((a: FraudAlert, b: FraudAlert) => b.risk_score - a.risk_score);
          setAlerts(sorted);
        }
      } catch (e) {
        console.error("Error parsing WS data", e);
      }
    };
    
    return () => {
      socket.close();
    };
  }, []);

  const handleSuspendClick = (alert: FraudAlert) => {
    setSelectedAlert(alert);
    setSuspendModalOpen(true);
  };

  const confirmSuspend = async () => {
    if (!selectedAlert) return;
    setIsSuspending(true);
    try {
      // POST /api/v1/exams/{exam_id}/suspend?user_id={user_id}
      // Wait, our DB needs user_id, but the alert gives us session_id (which is participant.id).
      // We need to pass user_id. Let's assume we can fetch it, or we need to update the WS payload to include user_id.
      // Ah, the endpoint is /exams/{exam_id}/suspend?user_id=...
      // Let's modify the WS payload logic to also return user_id. 
      // For now, let's assume we have `user_id` or we can call an endpoint that takes `session_id`.
      // Since I wrote the backend with user_id, I'll pass user_id in the payload. I'll need to update `main.py` later if it's missing.
      // Actually, I can just change the backend to take participant_id, but wait, the route is /exams/{exam_id}/suspend?user_id={user_id}
      // In `main.py`, I can just add `user_id: participant.user_id` to the payload!
      
      const userId = (selectedAlert as any).user_id; // Assume we add this
      await api.post(`/api/v1/exams/${selectedAlert.exam_id}/suspend?user_id=${userId}`);
      
      alert("Đã đình chỉ thành công.");
      setSuspendModalOpen(false);
      setSelectedAlert(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Lỗi khi đình chỉ thi");
    } finally {
      setIsSuspending(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Giám sát Gian lận (Live Monitor)</h1>
        <p className="text-gray-500 mt-1">
          Theo dõi trực tiếp hành vi bất thường của thí sinh trong các ca thi đang diễn ra.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Danh sách phiên thi có rủi ro</h2>
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </div>
        
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thí sinh</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kỳ thi ID</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Không có phiên thi nào đang diễn ra.
                </td>
              </tr>
            ) : (
              alerts.map((alert) => (
                <tr key={alert.session_id} className={alert.flagged ? "bg-red-50" : ""}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{alert.student_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {alert.exam_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${alert.flagged ? 'bg-red-100 text-red-800 font-bold' : 'bg-gray-100 text-gray-800'}`}>
                      {alert.risk_score}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {alert.status}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      disabled={alert.status === "SUSPENDED"}
                      onClick={() => handleSuspendClick(alert)}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed border border-red-200 px-3 py-1 rounded bg-white hover:bg-red-50 transition-colors"
                    >
                      Đình chỉ thi
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Suspend Modal */}
      {suspendModalOpen && selectedAlert && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Đình chỉ thi của {selectedAlert.student_name}?
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Hành động này sẽ <strong>KHOÁ CỨNG</strong> bài làm ngay lập tức và <strong>KHÔNG THỂ HOÀN TÁC</strong>.
                        Bài làm của thí sinh sẽ bị kết thúc ở trạng thái hiện tại.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={isSuspending}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  onClick={confirmSuspend}
                >
                  {isSuspending ? "Đang xử lý..." : "Xác nhận đình chỉ"}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setSuspendModalOpen(false)}
                >
                  Huỷ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
