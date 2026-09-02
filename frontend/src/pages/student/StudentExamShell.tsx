import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../stores/authStore";
import api from "../../api/client";
import QuestionNavGrid from "../../components/student/QuestionNavGrid";
import QuestionRenderer from "../../components/student/QuestionRenderer";
import PassageSplitPane from "../../components/student/PassageSplitPane";

export default function StudentExamShell() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [savedAnswers, setSavedAnswers] = useState<any>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  
  const [timeLeft, setTimeLeft] = useState<number>(0);
  
  // Anti-cheat refs
  const lastEventTime = useRef<number>(0);
  
  useEffect(() => {
    fetchSession();
  }, [id]);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/v1/exams/${id}/session`);
      const data = res.data;
      setSessionInfo(data);
      setTimeLeft(data.remaining_seconds);
      
      // Convert saved_answers to local state map
      const answersMap: any = {};
      data.saved_answers?.forEach((sa: any) => {
        answersMap[sa.exam_form_question_id] = sa;
      });
      setSavedAnswers(answersMap);
      
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load exam session");
    } finally {
      setLoading(false);
    }
  };

  // --- Anti Cheat Tracking ---
  const reportEvent = useCallback(async (actionType: string) => {
    const now = Date.now();
    // Debounce internal (UI only) but the server tracks each as 1.
    if (now - lastEventTime.current < 1000) return; 
    lastEventTime.current = now;
    
    try {
      await api.post(`/api/v1/exams/${id}/track`, { action_type: actionType });
      // Cảnh báo nhẹ cho thí sinh
      alert(`CẢNH BÁO: Hành vi [${actionType}] của bạn đã bị hệ thống ghi nhận vi phạm quy chế thi.`);
    } catch (err) {
      console.error("Failed to report event", err);
    }
  }, [id]);

  useEffect(() => {
    if (sessionInfo?.participant_status !== "IN_PROGRESS") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        reportEvent("tab_switch");
      }
    };

    const handleBlur = () => {
      reportEvent("blur");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [sessionInfo?.participant_status, reportEvent]);

  // --- Timer ---
  useEffect(() => {
    if (sessionInfo?.participant_status !== "IN_PROGRESS" || timeLeft <= 0) return;
    const timerId = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerId);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [sessionInfo?.participant_status, timeLeft]);

  // --- Actions ---
  const handleAnswerChange = async (exam_form_question_id: number, payload: any) => {
    if (sessionInfo?.participant_status !== "IN_PROGRESS") {
      alert("Phiên thi không còn hiệu lực.");
      return;
    }
    
    // Update local state immediately
    const newAnswers = { ...savedAnswers, [exam_form_question_id]: payload };
    setSavedAnswers(newAnswers);
    
    try {
      await api.post(`/api/v1/exams/${id}/autosave`, {
        answers: [
          {
            exam_form_question_id,
            ...payload
          }
        ]
      });
    } catch (err: any) {
      if (err.response?.status === 403) {
        alert("Phiên thi đã bị khoá hoặc thu bài.");
        fetchSession();
      }
    }
  };

  const handleAutoSubmit = async () => {
    try {
      await api.post(`/api/v1/exams/${id}/submit`);
      alert("Hết giờ làm bài. Hệ thống đã tự động thu bài.");
      navigate(`/student/exam/${id}/result`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualSubmit = async () => {
    if (!confirm("Bạn có chắc chắn muốn nộp bài? Hành động này không thể hoàn tác.")) return;
    try {
      await api.post(`/api/v1/exams/${id}/submit`);
      navigate(`/student/exam/${id}/result`);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Lỗi khi nộp bài");
    }
  };

  if (loading) return <div className="p-8 text-center">Đang tải đề thi...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  
  if (sessionInfo?.participant_status === "SUBMITTED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <h1 className="text-2xl font-bold text-green-600 mb-4">Bạn đã nộp bài</h1>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate(`/student/exam/${id}/result`)}
              className="px-4 py-2 bg-primary-600 text-white rounded"
            >
              Xem kết quả
            </button>
            <button
              onClick={() => navigate("/student")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded"
            >
              Quay lại trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (sessionInfo?.participant_status === "SUSPENDED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">PHIÊN THI BỊ ĐÌNH CHỈ</h1>
          <p className="mb-4">Bạn đã bị đình chỉ thi do vi phạm quy chế. Bài làm của bạn đã bị khoá.</p>
          <button onClick={() => navigate("/student")} className="px-4 py-2 bg-gray-600 text-white rounded">Về trang chủ</button>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = sessionInfo?.questions?.[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative overflow-hidden text-gray-900">
      {/* Watermark SBD */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] flex items-center justify-center flex-wrap gap-12 select-none overflow-hidden"
        style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 100px, rgba(0,0,0,0.1) 100px, rgba(0,0,0,0.1) 200px)` }}
      >
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} className="text-4xl font-bold tracking-widest rotate-45">{user?.id} - {user?.email}</div>
        ))}
      </div>
      
      {/* Header */}
      <header className="bg-white border-b shadow-sm relative z-10 px-6 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">{sessionInfo?.exam_name}</h1>
          <div className="text-sm text-gray-500">Mã đề: {sessionInfo?.form_code} | Thí sinh: {user?.full_name}</div>
        </div>
        <div className="flex items-center gap-6">
          <div className={`text-2xl font-mono font-bold ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-gray-800'}`}>
            {formatTime(timeLeft)}
          </div>
          <button 
            onClick={handleManualSubmit}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded shadow-sm transition-colors"
          >
            Nộp bài
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Side: Question Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {currentQuestion && (
            currentQuestion.passage_id ? (
              <PassageSplitPane 
                question={currentQuestion} 
                answer={savedAnswers[currentQuestion.exam_form_question_id]}
                onChange={(ans: any) => handleAnswerChange(currentQuestion.exam_form_question_id, ans)}
              />
            ) : (
              <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-sm border">
                <div className="mb-6 flex justify-between items-center border-b pb-4">
                  <h2 className="text-lg font-bold">Câu {currentQuestion.position} (Phần {currentQuestion.part})</h2>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-amber-600">
                    <input 
                      type="checkbox" 
                      className="form-checkbox text-amber-500 rounded focus:ring-amber-500"
                      checked={flaggedQuestions.has(currentQuestion.exam_form_question_id)}
                      onChange={(e) => {
                        const newSet = new Set(flaggedQuestions);
                        if (e.target.checked) newSet.add(currentQuestion.exam_form_question_id);
                        else newSet.delete(currentQuestion.exam_form_question_id);
                        setFlaggedQuestions(newSet);
                      }}
                    />
                    Đánh dấu xem lại
                  </label>
                </div>
                
                <QuestionRenderer 
                  question={currentQuestion} 
                  answer={savedAnswers[currentQuestion.exam_form_question_id]}
                  onChange={(ans: any) => handleAnswerChange(currentQuestion.exam_form_question_id, ans)}
                />
                
                <div className="mt-8 flex justify-between">
                  <button 
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex(i => i - 1)}
                    className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Câu trước
                  </button>
                  <button 
                    disabled={currentQuestionIndex === sessionInfo.questions.length - 1}
                    onClick={() => setCurrentQuestionIndex(i => i + 1)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 font-medium rounded disabled:opacity-50"
                  >
                    Câu tiếp theo
                  </button>
                </div>
              </div>
            )
          )}
        </div>
        
        {/* Right Side: Nav Grid */}
        <div className="w-80 bg-white border-l shadow-sm flex flex-col">
          <div className="p-4 border-b font-medium">Danh sách câu hỏi ({sessionInfo?.questions?.length})</div>
          <div className="p-4 flex-1 overflow-y-auto">
            <QuestionNavGrid 
              questions={sessionInfo?.questions || []}
              savedAnswers={savedAnswers}
              flaggedQuestions={flaggedQuestions}
              currentIndex={currentQuestionIndex}
              onSelect={setCurrentQuestionIndex}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
