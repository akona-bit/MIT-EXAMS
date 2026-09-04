import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../stores/authStore";
import NotificationBell from "./NotificationBell";

interface StudentShellProps {
  children: ReactNode;
  /** If provided, shows a back link instead of the full nav */
  backTo?: string;
  backLabel?: string;
}

export default function StudentShell({ children, backTo, backLabel }: StudentShellProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-50 glass-header border-b-transparent">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            {backTo ? (
              <Link
                to={backTo}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                {backLabel || "Trang chủ"}
              </Link>
            ) : (
              <>
                <Link to="/student" className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 text-lg font-bold text-white shadow-lg shadow-primary-500/25">
                  M
                </Link>
                <div>
                  <Link to="/student" className="font-extrabold tracking-tight hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    MIT EXAMS
                  </Link>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Khu vực thí sinh</p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            {!backTo && (
              <div className="hidden items-center gap-3 sm:flex rounded-full border border-slate-200/60 bg-white/60 dark:bg-slate-900/60 dark:border-slate-800/60 px-4 py-1.5 shadow-sm backdrop-blur-md">
                <div className="h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600 dark:text-primary-400">
                  {user?.username?.[0]?.toUpperCase() || "S"}
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {user?.username || user?.email}
                </span>
              </div>
            )}
            <button
              onClick={logout}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
