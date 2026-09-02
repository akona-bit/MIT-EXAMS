import { type ReactNode, useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../stores/authStore";
import { useTheme } from "../../stores/themeStore";
import { motion, AnimatePresence } from "framer-motion";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  Library,
  Network,
  FileEdit,
  BarChart3,
  BookMarked,
  FileText,
  KeyRound,
  LogOut,
  Menu,
  Sun,
  Moon,
  Share2,
  Users,
  Activity,
  ChevronDown,
  Search,
  X,
} from "lucide-react";

interface AdminShellProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

interface NavSection {
  id: string;
  label: string;
  icon: ReactNode;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    id: "overview",
    label: "Tổng quan",
    icon: <LayoutDashboard className="h-4 w-4" />,
    items: [
      { label: "Dashboard", path: "/admin", icon: <LayoutDashboard className="h-5 w-5" strokeWidth={1.8} /> },
    ],
  },
  {
    id: "content",
    label: "Nội dung & Kiến thức",
    icon: <Library className="h-4 w-4" />,
    items: [
      { label: "Ngân hàng Câu hỏi", path: "/admin/questions", icon: <Library className="h-5 w-5" strokeWidth={1.8} /> },
      { label: "Chủ đề Kiến thức", path: "/admin/obsidian", icon: <Share2 className="h-5 w-5" strokeWidth={1.8} /> },
      { label: "Kho ngữ liệu (Đọc)", path: "/admin/passages", icon: <BookMarked className="h-5 w-5" strokeWidth={1.8} /> },
      { label: "Lưu trữ (File/Ảnh)", path: "/admin/resources", icon: <FileText className="h-5 w-5" strokeWidth={1.8} /> },
      { label: "Ma trận Đặc tả", path: "/admin/matrix", icon: <Network className="h-5 w-5" strokeWidth={1.8} /> },
    ],
  },
  {
    id: "exam",
    label: "Vận hành Thi cử",
    icon: <FileEdit className="h-4 w-4" />,
    items: [
      { label: "Kỳ thi", path: "/admin/exams", icon: <FileEdit className="h-5 w-5" strokeWidth={1.8} /> },
      { label: "Quản lý Thí sinh", path: "/admin/students", icon: <Users className="h-5 w-5" strokeWidth={1.8} /> },
      { label: "Giám sát Gian lận", path: "/admin/analytics/fraud", icon: <Activity className="h-5 w-5" strokeWidth={1.8} /> },
      { label: "Quyền xem đáp án", path: "/admin/access", icon: <KeyRound className="h-5 w-5" strokeWidth={1.8} /> },
    ],
  },
  {
    id: "system",
    label: "Hệ thống",
    icon: <BarChart3 className="h-4 w-4" />,
    items: [
      { label: "Phân tích DS", path: "/admin/analytics/ds", icon: <BarChart3 className="h-5 w-5" strokeWidth={1.8} /> },
    ],
  },
];

const LS_SIDEBAR_SECTIONS = "admin-sidebar-sections";

function getStoredSections(): string[] {
  try {
    const stored = localStorage.getItem(LS_SIDEBAR_SECTIONS);
    if (stored) return JSON.parse(stored);
  } catch {}
  return navSections.map((s) => s.id);
}

function storeSections(ids: string[]) {
  localStorage.setItem(LS_SIDEBAR_SECTIONS, JSON.stringify(ids));
}

export default function AdminShell({ children }: AdminShellProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(getStoredSections);
  const [fps, setFps] = useState(60);
  const [onlineUsers, setOnlineUsers] = useState(1);

  // Find which section contains the active route
  const activeSectionId = useMemo(() => {
    for (const section of navSections) {
      for (const item of section.items) {
        if (
          location.pathname === item.path ||
          (item.path !== "/admin" && location.pathname.startsWith(item.path))
        ) {
          return section.id;
        }
      }
    }
    return null;
  }, [location.pathname]);

  // Auto-expand the section containing the active route
  useEffect(() => {
    if (activeSectionId) {
      setExpandedSections((prev) => {
        if (prev.includes(activeSectionId)) return prev;
        const next = [...prev, activeSectionId];
        storeSections(next);
        return next;
      });
    }
  }, [activeSectionId]);

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      storeSections(next);
      return next;
    });
  }, []);

  // Cmd+K / Ctrl+K handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setCmdOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // WebSocket + FPS (unchanged)
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/^http/, "ws") + "/ws/online"
      : `${protocol}//${window.location.hostname}:8000/ws/online`;

    let ws: WebSocket;
    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.onlineUsers !== undefined) setOnlineUsers(data.onlineUsers);
        } catch {}
      };
      ws.onclose = () => setTimeout(connect, 5000);
    };
    connect();
    return () => {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;
    const updateFPS = () => {
      const now = performance.now();
      frameCount++;
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animationFrameId = requestAnimationFrame(updateFPS);
    };
    animationFrameId = requestAnimationFrame(updateFPS);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const isActive = (item: NavItem) =>
    location.pathname === item.path ||
    (item.path !== "/admin" && location.pathname.startsWith(item.path));

  const handleCmdSelect = (path: string) => {
    setCmdOpen(false);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 selection:bg-primary-500/30">
      {/* Command Palette */}
      <AnimatePresence>
        {cmdOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm"
              onClick={() => setCmdOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.15 }}
              className="fixed left-1/2 top-[20%] z-[101] w-full max-w-lg -translate-x-1/2"
            >
              <Command className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-700">
                  <Search className="h-4 w-4 text-slate-400" />
                  <Command.Input
                    autoFocus
                    placeholder="Tìm tính năng... (⌘K)"
                    className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                  <button onClick={() => setCmdOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Command.List className="max-h-[320px] overflow-y-auto p-2">
                  <Command.Empty className="py-6 text-center text-sm text-slate-400">
                    Không tìm thấy kết quả.
                  </Command.Empty>
                  {navSections.map((section) => (
                    <Command.Group key={section.id} heading={section.label} className="mb-2">
                      {section.items.map((item) => (
                        <Command.Item
                          key={item.path}
                          value={item.label}
                          onSelect={() => handleCmdSelect(item.path)}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:data-[selected=true]:bg-primary-900/30 dark:data-[selected=true]:text-primary-300"
                        >
                          <span className="text-slate-400 dark:text-slate-500">{item.icon}</span>
                          <span>{item.label}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ))}
                </Command.List>
                <div className="border-t border-slate-200 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-700">
                  <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono dark:bg-slate-800">↑↓</kbd> di chuyển &nbsp;
                  <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono dark:bg-slate-800">↵</kbd> chọn &nbsp;
                  <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono dark:bg-slate-800">esc</kbd> đóng
                </div>
              </Command>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-white/60 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-[#030712]/60 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-3 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 shadow-lg shadow-primary-500/25">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-lg font-extrabold tracking-tintight text-slate-900 dark:text-white">MIT EXAMS</h1>
        </div>

        {/* Cmd+K search trigger */}
        <div className="px-4 pb-2">
          <button
            onClick={() => setCmdOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:border-slate-300 hover:bg-white hover:text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-500 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <Search className="h-4 w-4" />
            <span>Tìm nhanh...</span>
            <kbd className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 dark:bg-slate-800">⌘K</kbd>
          </button>
        </div>

        {/* Navigation sections */}
        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5 scrollbar-hide">
          {navSections.map((section) => {
            const isExpanded = expandedSections.includes(section.id);
            const hasActiveChild = section.items.some((item) => isActive(item));

            return (
              <div key={section.id}>
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                    hasActiveChild
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  }`}
                >
                  <span className="shrink-0">{section.icon}</span>
                  <span className="flex-1 text-left">{section.label}</span>
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 pb-1 pl-2">
                        {section.items.map((item) => {
                          const active = isActive(item);
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onClick={() => setSidebarOpen(false)}
                              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-300 overflow-hidden ${
                                active
                                  ? "text-primary-700 dark:text-primary-300"
                                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-white/5"
                              }`}
                            >
                              {active && (
                                <motion.div
                                  layoutId="activeNavIndicator"
                                  className="absolute inset-0 bg-white shadow-sm border border-white/60 dark:bg-slate-800/80 dark:border-white/10 rounded-xl"
                                  initial={false}
                                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                              )}
                              <span
                                className={`relative z-10 shrink-0 transition-colors ${
                                  active
                                    ? "text-primary-600 dark:text-primary-400"
                                    : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                                }`}
                              >
                                {item.icon}
                              </span>
                              <span className="relative z-10">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* User card */}
        <div className="p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/40 p-3 shadow-[0_4px_12px_rgb(0,0,0,0.05)] dark:border-white/10 dark:bg-slate-900/40 backdrop-blur-md">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white shadow-sm dark:bg-white dark:text-slate-900">
              {user?.username?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{user?.username || "Admin"}</p>
              <p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{user?.role?.name || "Administrator"}</p>
            </div>
            <button
              onClick={logout}
              className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-200/50 hover:text-danger-500 dark:hover:bg-slate-800/50"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-h-screen flex-col lg:pl-[280px]">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-white/60 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-[#030712]/60 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:flex items-center gap-4 rounded-full border border-slate-200/60 bg-white/60 px-4 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-300 shadow-sm">
                <div className="flex items-center gap-1.5" title="Khung hình/giây (FPS)">
                  <Activity className="h-3.5 w-3.5 text-blue-500" />
                  <span className="w-[42px] text-right">{fps} FPS</span>
                </div>
                <div className="h-3 w-[1px] bg-slate-300 dark:bg-slate-700"></div>
                <div className="flex items-center gap-1.5" title="Người dùng đang online">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                  <span>{onlineUsers} Online</span>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/60 bg-white/60 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white shadow-sm"
              >
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
