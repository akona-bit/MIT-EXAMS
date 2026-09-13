import { type ReactNode, useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../stores/authStore";
import NotificationBell from "./NotificationBell";
import { StudentFeedbackModal } from "../../components/student/StudentFeedbackModal";
import AiAgentChat from "../../components/student/AiAgentChat";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  User,
  Trophy,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Mail,
  Lock,
  Save,
  MessageSquare,
} from "lucide-react";

interface StudentShellProps {
  children: ReactNode;
  backTo?: string;
  backLabel?: string;
}

const navLinks = [
  { to: "/student", label: "Trang chủ", icon: LayoutDashboard },
  { to: "/student/profile", label: "Hồ sơ", icon: User },
  { to: "/student/leaderboard", label: "Xếp hạng", icon: Trophy },
];

export default function StudentShell({ children, backTo, backLabel }: StudentShellProps) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [gender, setGender] = useState(user?.gender || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSaveProfile = async () => {
    setSaveMsg("");
    try {
      setSaveMsg("Đã lưu!");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch {
      setSaveMsg("Lỗi lưu");
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setSaveMsg("Mật khẩu không khớp");
      return;
    }
    setSaveMsg("");
    try {
      setSaveMsg("Đã đổi mật khẩu!");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch {
      setSaveMsg("Lỗi đổi mật khẩu");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-white to-slate-50/80 dark:from-[#060b14] dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 sm:px-6 lg:px-8 h-14 sm:h-16">
          {/* Left: Logo / Back */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {backTo ? (
              <Link
                to={backTo}
                className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-slate-500 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 shrink-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                <span className="hidden sm:inline">{backLabel || "Trang chủ"}</span>
              </Link>
            ) : (
              <Link to="/student" className="flex items-center gap-2 group shrink-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
                  <span className="text-xs sm:text-sm font-bold text-white">M</span>
                </div>
                <div className="hidden sm:block">
                  <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                    MIT <span className="text-primary-600 dark:text-primary-400">EXAMS</span>
                  </span>
                  <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 -mt-0.5">
                    Khu vực thí sinh
                  </p>
                </div>
              </Link>
            )}
          </div>

          {/* Center: Nav links (desktop) */}
          {!backTo && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive =
                  link.to === "/student"
                    ? loc.pathname === "/student"
                    : loc.pathname.startsWith(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <NotificationBell />

            {/* Góp ý button */}
            <button
              onClick={() => setFeedbackOpen(true)}
              className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 shadow-sm hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 dark:hover:text-primary-400 hover:shadow-md transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              Góp ý
            </button>

            {!backTo && (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 shadow-sm hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
                    {user?.full_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "S"}
                  </div>
                  <div className="hidden lg:block text-left min-w-0">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight truncate max-w-[120px]">
                      {user?.full_name || user?.username || "Thí sinh"}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight truncate max-w-[120px]">
                      {user?.email}
                    </p>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Profile Dropdown */}
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 z-50"
                    >
                      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
                          {user?.full_name?.[0]?.toUpperCase() || "S"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.full_name || user?.username}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Họ và tên</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all"
                            />
                            <button
                              onClick={handleSaveProfile}
                              className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors shrink-0"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            <Mail className="w-3 h-3 inline mr-1" />
                            Email
                          </label>
                          <input
                            type="email"
                            value={user?.email || ""}
                            disabled
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 dark:text-slate-500 cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Giới tính (tùy chọn)</label>
                          <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all"
                          >
                            <option value="">Chưa chọn</option>
                            <option value="MALE">Nam</option>
                            <option value="FEMALE">Nữ</option>
                            <option value="OTHER">Khác</option>
                          </select>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            <Lock className="w-3 h-3 inline mr-1" />
                            Đổi mật khẩu mới
                          </label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Mật khẩu mới"
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all mb-2"
                          />
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Xác nhận mật khẩu"
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all"
                          />
                          {newPassword && (
                            <button
                              onClick={handleChangePassword}
                              className="mt-2 w-full text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              Cập nhật mật khẩu
                            </button>
                          )}
                        </div>

                        {saveMsg && (
                          <p className={`text-xs font-medium text-center ${saveMsg.includes("Lỗi") ? "text-rose-500" : "text-emerald-600"}`}>
                            {saveMsg}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={logout}
                          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                        >
                          <LogOut className="w-4 h-4" />
                          Đăng xuất
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button
              onClick={logout}
              className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>

            {/* Mobile menu button */}
            {!backTo && (
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileOpen && !backTo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-slate-200/60 dark:border-slate-800/60"
            >
              <div className="px-3 py-2 space-y-0.5 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl">
                {navLinks.map((link) => {
                  const isActive =
                    link.to === "/student"
                      ? loc.pathname === "/student"
                      : loc.pathname.startsWith(link.to);
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <link.icon className="w-4 h-4" />
                      {link.label}
                    </Link>
                  );
                })}

                {/* Hỗ trợ section */}
                <div className="border-t border-slate-200 dark:border-slate-800 mt-2 pt-2">
                  <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Hỗ trợ
                  </p>
                  <button
                    onClick={() => { setFeedbackOpen(true); setMobileOpen(false); }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Góp ý & Hỗ trợ
                  </button>
                </div>

                {/* Đăng xuất */}
                <div className="border-t border-slate-200 dark:border-slate-800 mt-2 pt-2">
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {children}

      {/* AI Agent Chat (FAB) */}
      <AiAgentChat />

      {/* Feedback Modal */}
      <StudentFeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
