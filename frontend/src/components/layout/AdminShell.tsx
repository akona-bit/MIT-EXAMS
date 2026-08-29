import { type ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../stores/authStore";
import { useTheme } from "../../stores/themeStore";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  Library, 
  Network, 
  FileEdit, 
  BarChart3, 
  Database, 
  BookMarked, 
  KeyRound, 
  LogOut,
  Menu,
  Sun,
  Moon
} from "lucide-react";

interface AdminShellProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/admin", icon: <LayoutDashboard className="h-5 w-5" strokeWidth={1.8} /> },
  { label: "Ngân hàng Câu hỏi", path: "/admin/questions", icon: <Library className="h-5 w-5" strokeWidth={1.8} /> },
  { label: "Ma trận Đặc tả", path: "/admin/matrix", icon: <Network className="h-5 w-5" strokeWidth={1.8} /> },
  { label: "Kỳ thi", path: "/admin/exams", icon: <FileEdit className="h-5 w-5" strokeWidth={1.8} /> },
  { label: "Điểm thi (HS)", path: "/admin/analytics/student", icon: <BarChart3 className="h-5 w-5" strokeWidth={1.8} /> },
  { label: "Thống kê (GV)", path: "/admin/analytics/teacher", icon: <Database className="h-5 w-5" strokeWidth={1.8} /> },
  { label: "Kho ngữ liệu", path: "/admin/resources", icon: <BookMarked className="h-5 w-5" strokeWidth={1.8} /> },
  { label: "Quyền xem đáp án", path: "/admin/access", icon: <KeyRound className="h-5 w-5" strokeWidth={1.8} /> },
];

export default function AdminShell({ children }: AdminShellProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 selection:bg-primary-500/30">
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
        className={`fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-neutral-950 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 shadow-lg shadow-primary-500/25">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">MIT EXAMS</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-hide">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/admin" && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-300 overflow-hidden ${
                  isActive
                    ? "text-primary-700 dark:text-primary-300"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute inset-0 bg-slate-100 dark:bg-slate-800 rounded-xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 shrink-0 transition-colors ${isActive ? "text-primary-600 dark:text-primary-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`}>
                  {item.icon}
                </span>
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-neutral-900">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white dark:bg-white dark:text-slate-900">
              {user?.username?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {user?.username || "Admin"}
              </p>
              <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                {user?.role?.name || "Administrator"}
              </p>
            </div>
            <button
              onClick={logout}
              className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-danger-500 dark:hover:bg-slate-800"
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
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-neutral-950/80 transition-all duration-300">
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
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200/60 bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-300 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                Hệ thống ổn định
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
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
