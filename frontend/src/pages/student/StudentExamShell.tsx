import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../stores/authStore";
import api from "../../api/client";
import QuestionRenderer from "../../components/student/QuestionRenderer";
import QuestionNavStrip from "../../components/student/QuestionNavGrid";
import { getMaintenanceStatus, type MaintenanceStatus } from "../../api/system";
import MaintenanceScreen from "../../components/ui/MaintenanceScreen";
import LoadingScreen from "../../components/ui/LoadingScreen";

import { StudentFeedbackModal } from "../../components/student/StudentFeedbackModal";
import { MessageSquare } from "lucide-react";
import { toast } from '../../components/ui/Toast';
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import VerificationUploadModal from "../../components/student/VerificationUploadModal";
import { sanitizeHtml } from '../../utils/sanitize';
import { supabase } from "../../lib/supabase";
import { UploadCloud } from "lucide-react";

// ─── Anti-cheat: blocked keys ───
const BLOCKED_KEYS = new Set([
  "F12",
  "PrintScreen",
]);
const BLOCKED_CTRL_KEYS = new Set(["c", "v", "a", "u", "s", "p"]);

export default function StudentExamShell() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const examMode = location.state?.mode || 'online'; // 'online' or 'omr'

  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [savedAnswers, setSavedAnswers] = useState<any>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(
    new Set()
  );
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Anti-cheat state
  const lastEventTime = useRef<number>(0);
  const [violationCount, setViolationCount] = useState(0);
  const [showWarningBanner, setShowWarningBanner] = useState(false);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Passage cache
  const [passageCache, setPassageCache] = useState<Record<number, any>>({});
  // Submit confirmation dialog
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showMissingAnswersWarning, setShowMissingAnswersWarning] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [loadingPassage, setLoadingPassage] = useState(false);
  const [maintenance, setMaintenance] = useState<MaintenanceStatus | null>(null);

  // OMR Upload State
  const [omrImage, setOmrImage] = useState<File | null>(null);
  const [isUploadingOmr, setIsUploadingOmr] = useState(false);
  const [omrPreview, setOmrPreview] = useState<string | null>(null);

  // ─── Fetch session ───
  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const status = await getMaintenanceStatus();
        setMaintenance(status);
        if (!status.maintenance_mode_all && !status.maintenance_mode_exam) {
          fetchSession();
        } else {
          setLoading(false);
        }
      } catch (err) {
        // Fallback
        fetchSession();
      }
    };
    checkMaintenance();
  }, [id]);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/v1/exams/${id}/session`);
      const data = res.data;
      setSessionInfo(data);
      setTimeLeft(data.remaining_seconds);
      const answersMap: any = {};
      data.saved_answers?.forEach((sa: any) => {
        answersMap[sa.exam_form_question_id] = sa;
      });
      setSavedAnswers(answersMap);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Không thể tải phiên thi");
    } finally {
      setLoading(false);
    }
  };

  // ─── Fetch passage on demand ───
  const currentQuestion = sessionInfo?.questions?.[currentQuestionIndex];
  useEffect(() => {
    if (!currentQuestion?.passage_id) return;
    if (passageCache[currentQuestion.passage_id]) return;
    setLoadingPassage(true);
    api
      .get(`/api/v1/passages/${currentQuestion.passage_id}`)
      .then((res) => {
        setPassageCache((prev) => ({
          ...prev,
          [currentQuestion.passage_id]: res.data,
        }));
      })
      .catch(console.error)
      .finally(() => setLoadingPassage(false));
  }, [currentQuestion?.passage_id]);


  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // ═══════════════════════════════════════════
  //  ANTI-CHEAT — Comprehensive Protection
  // ═══════════════════════════════════════════

  const reportViolation = useCallback(
    async (actionType: string) => {
      const now = Date.now();
      if (now - lastEventTime.current < 800) return;
      lastEventTime.current = now;

      setViolationCount((c) => c + 1);
      setShowWarningBanner(true);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      warningTimerRef.current = setTimeout(
        () => setShowWarningBanner(false),
        8000
      );

      try {
        await api.post(`/api/v1/exams/${id}/track`, {
          action_type: actionType,
        });
      } catch {
        /* silently fail */
      }
    },
    [id]
  );

  useEffect(() => {
    if (sessionInfo?.participant_status !== "IN_PROGRESS" || examMode === 'omr') return;

    // 1. Tab switch / blur
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") reportViolation("tab_switch");
    };
    const onBlur = () => reportViolation("blur");

    // 2. Copy / Cut / Paste / Context menu / Select
    const blockClipboard = (e: Event) => {
      e.preventDefault();
      reportViolation(e.type);
    };

    // 3. Keyboard shortcuts
    const onKeyDown = (e: KeyboardEvent) => {
      if (BLOCKED_KEYS.has(e.key)) {
        e.preventDefault();
        reportViolation(`key_${e.key}`);
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        BLOCKED_CTRL_KEYS.has(e.key.toLowerCase())
      ) {
        e.preventDefault();
        reportViolation(`ctrl_${e.key.toLowerCase()}`);
      }
    };

    // 4. DevTools detector (resize heuristic)
    const devtoolsThreshold = 160;
    const onResize = () => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > devtoolsThreshold || heightDiff > devtoolsThreshold) {
        reportViolation("devtools_open");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", blockClipboard);
    document.addEventListener("cut", blockClipboard);
    document.addEventListener("paste", blockClipboard);
    document.addEventListener("contextmenu", blockClipboard);
    document.addEventListener("selectstart", blockClipboard);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", blockClipboard);
      document.removeEventListener("cut", blockClipboard);
      document.removeEventListener("paste", blockClipboard);
      document.removeEventListener("contextmenu", blockClipboard);
      document.removeEventListener("selectstart", blockClipboard);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [sessionInfo?.participant_status, reportViolation]);

  // ─── Actions ───
  const handleAnswerChange = async (
    exam_form_question_id: number,
    payload: any
  ) => {
    if (sessionInfo?.participant_status !== "IN_PROGRESS") return;
    const newAnswers = { ...savedAnswers, [exam_form_question_id]: payload };
    setSavedAnswers(newAnswers);
    try {
      await api.post(`/api/v1/exams/${id}/autosave`, {
        answers: [{ exam_form_question_id, ...payload }],
      });
    } catch (err: any) {
      if (err.response?.status === 403) {
        fetchSession();
      }
    }
  };

  const handleAutoSubmit = async () => {
    try {
      let uploadedUrl: string | undefined = undefined;
      if (examMode === 'omr' && omrImage) {
         uploadedUrl = await uploadOmrImage(omrImage);
      }
      const res = await api.post(`/api/v1/exams/${id}/submit`, { omr_image_url: uploadedUrl });
      if (res.data.status === "needs_verification") {
        setShowVerificationModal(true);
        return;
      }
      fetchSession();
    } catch {
      /* */
    }
  };

  const uploadOmrImage = async (file: File): Promise<string | undefined> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}_${id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error } = await supabase.storage
        .from('omr-submissions')
        .upload(filePath, file);

      if (error) {
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('omr-submissions')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error("Upload OMR failed:", err);
      return undefined;
    }
  };

  // ─── Timer (uses ref to avoid stale closure) ───
  const handleAutoSubmitRef = useRef(handleAutoSubmit);
  handleAutoSubmitRef.current = handleAutoSubmit;

  useEffect(() => {
    if (sessionInfo?.participant_status !== "IN_PROGRESS" || timeLeft === null || timeLeft <= 0)
      return;
    const timerId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timerId);
          handleAutoSubmitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [sessionInfo?.participant_status, timeLeft]);

  // Auto-submit immediately if time is already up when loading the session
  useEffect(() => {
    if (sessionInfo?.participant_status === "IN_PROGRESS" && timeLeft !== null && timeLeft <= 0) {
      handleAutoSubmitRef.current();
    }
  }, [sessionInfo?.participant_status, timeLeft]);

  const handleManualSubmit = async () => {
    if (examMode === 'online' && answeredCount < totalQuestions && !showMissingAnswersWarning) {
      setShowMissingAnswersWarning(true);
      setShowSubmitConfirm(true);
      return;
    }
    if (examMode === 'omr' && !omrImage) {
      toast.error("Vui lòng tải lên ảnh phiếu trả lời (OMR) trước khi nộp bài");
      return;
    }
    
    setShowSubmitConfirm(false);
    try {
      setIsUploadingOmr(true);
      let uploadedUrl: string | undefined = undefined;
      if (examMode === 'omr' && omrImage) {
         uploadedUrl = await uploadOmrImage(omrImage);
         if (!uploadedUrl) {
            toast.error("Lỗi khi tải ảnh lên, vui lòng thử lại!");
            setIsUploadingOmr(false);
            return;
         }
      }
      const res = await api.post(`/api/v1/exams/${id}/submit`, { omr_image_url: uploadedUrl });
      if (res.data.status === "needs_verification") {
        setShowVerificationModal(true);
        setIsUploadingOmr(false);
        return;
      }
      fetchSession();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Lỗi khi nộp bài");
    } finally {
      setIsUploadingOmr(false);
    }
  };

  const toggleFlag = (qId: number) => {
    const newSet = new Set(flaggedQuestions);
    if (newSet.has(qId)) newSet.delete(qId);
    else newSet.add(qId);
    setFlaggedQuestions(newSet);
  };

  // Scroll to active question
  useEffect(() => {
    const el = document.getElementById(`question-${currentQuestionIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentQuestionIndex]);

  // ─── Format helpers ───
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0)
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const answeredCount = Object.keys(savedAnswers).length;
  const totalQuestions = sessionInfo?.questions?.length || 0;
  const isUrgent = timeLeft !== null && timeLeft < 300;

  if (maintenance?.maintenance_mode_all || maintenance?.maintenance_mode_exam) {
    return <MaintenanceScreen />;
  }

  if (loading) {
    return <LoadingScreen message="Đang tải đề thi..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-600 mb-2">Lỗi</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => navigate("/student")}
            className="px-6 py-2 bg-slate-600 text-white rounded-lg"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  if (sessionInfo?.participant_status === "SUBMITTED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-green-700 mb-2">
            Bạn đã nộp bài thành công
          </h1>
          <p className="text-slate-500 mb-6">
            Bài làm của bạn đã được ghi nhận vào hệ thống.
          </p>
          <div className="flex flex-col gap-3">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 mb-2 text-sm text-blue-800 text-left">
              <p className="font-semibold mb-1">ℹ️ Lưu ý:</p>
              <p>Điểm thi và đáp án sẽ được công bố sau khi ban tổ chức hoàn tất quá trình chấm điểm.</p>
              <p className="mt-2 text-xs italic text-blue-600">
                * Chỉ những thí sinh có quyền xem đáp án mới có thể xem chi tiết bài làm của mình.
              </p>
            </div>
            <button
              onClick={() => navigate("/student")}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
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
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md border-2 border-red-200">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-red-700 mb-2">
            PHIÊN THI BỊ ĐÌNH CHỈ
          </h1>
          <p className="text-slate-600 mb-6">
            Bạn đã bị đình chỉ thi do vi phạm quy chế. Bài làm của bạn đã bị
            khoá.
          </p>
          <button
            onClick={() => navigate("/student")}
            className="px-6 py-3 bg-slate-600 text-white rounded-lg"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  MAIN EXAM UI — Bộ GD&ĐT Style
  // ═══════════════════════════════════════════

  // Group questions by passage
  const questionGroups: any[] = [];
  if (sessionInfo?.questions) {
    sessionInfo.questions.forEach((q: any, idx: number) => {
      const qWithIndex = { ...q, absoluteIndex: idx };
      if (!q.passage_id) {
        questionGroups.push({ type: 'single', questions: [qWithIndex] });
      } else {
        const lastGroup = questionGroups[questionGroups.length - 1];
        if (lastGroup && lastGroup.type === 'passage' && lastGroup.passage_id === q.passage_id) {
          lastGroup.questions.push(qWithIndex);
        } else {
          questionGroups.push({ type: 'passage', passage_id: q.passage_id, questions: [qWithIndex] });
        }
      }
    });
  }
  
  // Find which group contains the currentQuestionIndex
  let currentGroupIndex = 0;
  for (let i = 0; i < questionGroups.length; i++) {
    if (questionGroups[i].questions.some((q: any) => q.absoluteIndex === currentQuestionIndex)) {
      currentGroupIndex = i;
      break;
    }
  }
  const currentGroup = questionGroups[currentGroupIndex];
  
  const currentPassage = currentGroup?.passage_id
    ? passageCache[currentGroup.passage_id]
    : null;
  const hasPassage = currentGroup?.type === 'passage';

  return (
    <div
      className="h-screen supports-[height:100dvh]:h-[100dvh] flex flex-col bg-slate-100 text-slate-900 overflow-hidden"
      style={{ userSelect: "none" }}
    >
      {/* ── Watermark SBD (Background Pattern) ── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="watermark"
              patternUnits="userSpaceOnUse"
              width="320"
              height="200"
              patternTransform="rotate(-30)"
            >
              <text
                x="10"
                y="60"
                fill="rgba(0,0,0,0.025)"
                fontSize="18"
                fontFamily="monospace"
                fontWeight="bold"
              >
                SBD: {user?.id} — {user?.full_name || user?.username}
              </text>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#watermark)" />
        </svg>
      </div>

      {/* ── Violation Warning Banner ── */}
      {showWarningBanner && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white px-6 py-3 flex items-center justify-between shadow-xl animate-pulse">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <span className="font-bold text-sm">
              ⚠ CẢNH BÁO: Hành vi của bạn đã bị hệ thống ghi nhận vi phạm quy
              chế thi. (Tổng: {violationCount} lần)
            </span>
          </div>
          <button
            className="text-white/80 hover:text-white text-xs font-medium border border-white/30 px-3 py-1 rounded"
            onClick={() => setShowWarningBanner(false)}
          >
            Đã hiểu
          </button>
        </div>
      )}

      {/* ══ HEADER — Blue Bar ══ */}
      <header className="relative z-20 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 text-white shadow-lg shrink-0">
        <div className="flex items-center justify-between px-5 py-2.5">
          {/* Left: Student Info */}
          <div className="flex items-center gap-6 text-sm">
            <div className="font-bold text-base tracking-tight">
              {user?.full_name || user?.username}
            </div>
            <div className="hidden md:flex items-center gap-4 text-blue-100 text-xs">
              <span>
                SBD:{" "}
                <strong className="text-white">
                  {String(user?.id).padStart(6, "0")}
                </strong>
              </span>
              <span className="text-blue-300">|</span>
              <span>
                Mã đề:{" "}
                <strong className="text-white">
                  {sessionInfo?.form_code}
                </strong>
              </span>
              <span className="text-blue-300">|</span>
              <span>{sessionInfo?.exam_name}</span>
            </div>
          </div>

          {/* Right: Timer + Status + Submit */}
          <div className="flex items-center gap-4">
            {/* Timer */}
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-mono text-lg font-bold tracking-wider ${
                isUrgent
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-white/15 text-white"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {timeLeft === null ? "Không giới hạn thời gian" : formatTime(timeLeft)}
            </div>

            {/* Feedback Button */}
            <button
              onClick={() => setIsFeedbackOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs bg-white/10 text-blue-100 hover:bg-white/20 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Góp ý
            </button>

            {/* Connection indicator */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-blue-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
              Đang kết nối
            </div>

            {/* Answered counter */}
            <div className="hidden sm:block text-xs text-blue-100 bg-white/10 px-3 py-1.5 rounded-lg">
              Đã trả lời:{" "}
              <strong className="text-white">
                {answeredCount}/{totalQuestions}
              </strong>
            </div>

            {/* Submit button */}
            <button
              onClick={() => setShowSubmitConfirm(true)}
              disabled={isUploadingOmr}
              className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-lg shadow-md hover:shadow-lg transition-all uppercase tracking-wide disabled:opacity-50"
            >
              {isUploadingOmr ? "ĐANG TẢI LÊN..." : "NỘP BÀI"}
            </button>
          </div>
        </div>
      </header>

      {/* ══ BODY — Split Layout (mobile: xếp dọc; md+: chia đôi ngang) ══ */}
      <main className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative z-10">
        {/* Left Pane: Passage / Question Content */}
        {hasPassage && (
          <div className="w-full md:w-1/2 h-[35%] md:h-auto shrink-0 border-b-2 md:border-b-0 md:border-r-2 border-slate-300 bg-white flex flex-col min-h-0">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-700 flex items-center gap-2">
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Ngữ liệu
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {loadingPassage ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-4 bg-slate-200 rounded w-full" />
                  <div className="h-4 bg-slate-200 rounded w-5/6" />
                  <div className="h-4 bg-slate-200 rounded w-full" />
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                </div>
              ) : currentPassage ? (
                <div
                  className="prose prose-sm max-w-none text-slate-800 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentPassage.content) }}
                />
              ) : (
                <p className="text-slate-400 italic">
                  Đang tải ngữ liệu...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Right Pane: Question + Answers or OMR Upload */}
        <div
          className={`${hasPassage ? "w-full md:w-1/2" : "w-full"} flex-1 min-h-0 bg-white flex flex-col`}
        >
          {examMode === 'omr' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 overflow-y-auto">
              <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Nộp bài thi bằng phiếu OMR</h2>
                <p className="text-slate-500 text-sm mb-8">
                  Bạn đang làm bài theo hình thức trên giấy. Vui lòng chụp ảnh phiếu trả lời (OMR) rõ nét và tải lên đây.
                </p>

                {omrPreview ? (
                  <div className="relative mb-6 group">
                    <img src={omrPreview} alt="OMR Preview" className="w-full rounded-xl border-2 border-blue-500 object-contain max-h-96" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                      <button 
                        onClick={() => { setOmrImage(null); setOmrPreview(null); }}
                        className="px-4 py-2 bg-white text-rose-600 font-semibold rounded-lg shadow"
                      >
                        Xóa và tải lại
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-blue-50 hover:border-blue-400 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-10 h-10 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                      <p className="mb-2 text-sm text-slate-500 font-semibold">Nhấn để tải ảnh hoặc chụp ảnh</p>
                      <p className="text-xs text-slate-500">Hỗ trợ JPG, PNG (tối đa 10MB)</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setOmrImage(file);
                          const reader = new FileReader();
                          reader.onloadend = () => setOmrPreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}
                
                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-left">
                  <span className="text-sm font-semibold text-slate-700">Trạng thái:</span>
                  {omrImage ? (
                    <span className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Đã tải ảnh lên
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-amber-500">Chưa tải ảnh</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Question body — scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-5 scroll-smooth" id="questions-container">
                {currentGroup && currentGroup.questions.map((q: any) => (
                  <div 
                    key={q.exam_form_question_id}
                    id={`question-${q.absoluteIndex}`}
                    className={`mb-8 ${currentQuestionIndex === q.absoluteIndex ? 'ring-2 ring-blue-100 bg-blue-50/30 p-4 rounded-xl' : 'p-4'}`}
                    onClick={() => {
                       if (currentQuestionIndex !== q.absoluteIndex) {
                          setCurrentQuestionIndex(q.absoluteIndex);
                       }
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-slate-700">
                        Câu {q.position}{" "}
                        <span className="text-slate-400 font-normal">
                          (Phần {q.part})
                        </span>
                      </h2>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFlag(q.exam_form_question_id); }}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                            flaggedQuestions.has(q.exam_form_question_id)
                              ? "bg-amber-50 border-amber-300 text-amber-700"
                              : "bg-white border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600"
                          }`}
                          title="Đánh dấu xem lại"
                        >
                          <svg
                            className="w-4 h-4"
                            fill={
                              flaggedQuestions.has(q.exam_form_question_id)
                                ? "currentColor"
                                : "none"
                            }
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                            />
                          </svg>
                          Đánh dấu
                        </button>
                      </div>
                    </div>

                    <QuestionRenderer
                      question={q}
                      answer={savedAnswers[q.exam_form_question_id]}
                      onChange={(ans: any) =>
                        handleAnswerChange(q.exam_form_question_id, ans)
                      }
                    />
                  </div>
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                <button
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex((i) => i - 1)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Quay lại
                </button>
                <span className="text-xs text-slate-400">
                  {currentQuestionIndex + 1} / {totalQuestions}
                </span>
                <button
                  disabled={currentQuestionIndex === totalQuestions - 1}
                  onClick={() => setCurrentQuestionIndex((i) => i + 1)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Tiếp theo
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ══ FOOTER — Question Navigation Strip ══ */}
      {examMode === 'online' && (
        <footer className="relative z-20 bg-white border-t-2 border-slate-300 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] shrink-0">
          <div className="px-4 py-3">
            <QuestionNavStrip
              questions={sessionInfo?.questions || []}
              savedAnswers={savedAnswers}
              flaggedQuestions={flaggedQuestions}
              currentIndex={currentQuestionIndex}
              onSelect={setCurrentQuestionIndex}
              showMissingWarning={showMissingAnswersWarning}
            />
          </div>
        </footer>
      )}

      <ConfirmDialog
        isOpen={showSubmitConfirm}
        title={examMode === 'omr' ? "Nộp ảnh phiếu OMR" : (showMissingAnswersWarning ? "Chưa hoàn thành bài thi" : "Nộp bài thi")}
        message={
          examMode === 'omr' 
            ? "Bạn có chắc chắn muốn nộp phiếu trả lời này không? Xin hãy kiểm tra ảnh rõ nét trước khi xác nhận." 
            : (showMissingAnswersWarning
            ? `Bạn còn ${totalQuestions - answeredCount} câu chưa chọn đáp án. Bài làm còn thiếu sót. Bạn có CHẮC CHẮN muốn nộp bài lúc này không?`
            : "Bạn có chắc chắn muốn nộp bài? Sau khi nộp, bạn sẽ không thể thay đổi bài làm.")
        }
        confirmText="Xác nhận nộp bài"
        onConfirm={() => {
          setShowSubmitConfirm(false);
          setShowMissingAnswersWarning(false);
          handleManualSubmit();
        }}
        onCancel={() => setShowSubmitConfirm(false)}
      />

      <VerificationUploadModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        examId={Number(id)}
        onSuccess={() => {
          setShowVerificationModal(false);
          fetchSession();
        }}
      />

      <StudentFeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        examSessionId={id}
      />
    </div>
  );
}
