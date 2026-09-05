import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./stores/authStore";
import { ThemeProvider } from "./stores/themeStore";
import { NotificationProvider } from "./stores/notificationStore";
import { ToastProvider } from "./components/ui/Toast";
import ErrorBoundary from "./components/ui/ErrorBoundary";
// Layouts (nhỏ, giữ eager)
import AdminShell from "./components/layout/AdminShell";
import StudentShell from "./components/layout/StudentShell";

// Pages — lazy-load theo route (code splitting): thí sinh không phải tải
// bundle admin nặng (plotly, recharts, tiptap...) và ngược lại.
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const GuestPage = lazy(() => import("./pages/auth/GuestPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const DashboardPage = lazy(() => import("./pages/admin/DashboardPage"));
const PassageFormPage = lazy(() => import("./pages/admin/PassageFormPage"));
const QuestionsPage = lazy(() => import("./pages/admin/QuestionsPage"));
const QuestionFormPage = lazy(() => import("./pages/admin/QuestionFormPage"));
const PassageGroupWizard = lazy(() => import("./components/admin/passage/PassageGroupWizard"));
const MatrixPage = lazy(() => import("./pages/admin/MatrixPage"));
const MatrixFormPage = lazy(() => import("./pages/admin/MatrixFormPage"));
const MatrixDetailPage = lazy(() => import("./pages/admin/MatrixDetailPage"));
const ExamsPage = lazy(() => import("./pages/admin/ExamsPage"));
const ExamDetailPage = lazy(() => import("./pages/admin/ExamDetailPage"));
const ExamFormPage = lazy(() => import("./pages/admin/ExamFormPage"));
const StudentHomePage = lazy(() => import("./pages/student/StudentHomePage"));
const StudentExamShell = lazy(() => import("./pages/student/StudentExamShell"));
const StudentExamResultPage = lazy(() => import("./pages/student/StudentExamResultPage"));
const StudentDetailPage = lazy(() => import("./pages/student/StudentDetailPage"));
const StudentComparePage = lazy(() => import("./pages/student/StudentComparePage"));

const KnowledgePage = lazy(() => import("./pages/admin/KnowledgePage"));
const ResourcesPage = lazy(() => import("./pages/admin/ResourcesPage"));
const AccessControlPage = lazy(() => import("./pages/admin/AccessControlPage"));
const OmrPage = lazy(() => import("./pages/admin/OmrPage"));

const StudentManagementPage = lazy(() => import("./pages/admin/analytics/StudentManagementPage"));
const AdvancedAnalyticsPage = lazy(() => import("./pages/admin/analytics/AdvancedAnalyticsPage"));
const SystemSettingsPage = lazy(() => import("./pages/admin/settings/SystemSettingsPage"));
const AdminFeedbacksPage = lazy(() => import("./pages/admin/AdminFeedbacksPage"));
const AdminNotificationsPage = lazy(() => import("./pages/admin/AdminNotificationsPage"));

// Fallback khi đang tải chunk của route (khớp design system, không flash trắng)
function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  );
}

// --- Route Guards ---

// Protect routes that require login
function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user?.role && !allowedRoles.includes(user.role.name)) {
    // If not allowed, redirect to appropriate home based on role
    if (user.role.name === "STUDENT") return <Navigate to="/student" replace />;
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}

// Redirect logged-in users away from auth pages (login/register)
function PublicRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (isAuthenticated) {
    if (user?.role?.name === "STUDENT")
      return <Navigate to="/student" replace />;
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/guest" element={<GuestPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Admin/Teacher Routes */}
      <Route element={<ProtectedRoute allowedRoles={["ADMIN", "TEACHER"]} />}>
        <Route
          path="/admin"
          element={
            <AdminShell>
              <Outlet />
            </AdminShell>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="passages/new" element={<PassageFormPage />} />
          <Route path="passages/:id/edit" element={<PassageFormPage />} />
          <Route path="questions" element={<QuestionsPage />} />
          <Route path="questions/new" element={<QuestionFormPage />} />
          <Route path="questions/new-group" element={<PassageGroupWizard />} />
          <Route path="questions/:id/edit" element={<QuestionFormPage />} />
          <Route path="matrix" element={<MatrixPage />} />
          <Route path="matrix/new" element={<MatrixFormPage />} />
          <Route path="matrix/:id" element={<MatrixDetailPage />} />
          <Route path="matrix/:id/edit" element={<MatrixFormPage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="exams/new" element={<ExamFormPage />} />
          <Route path="exams/:id" element={<ExamDetailPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="omr" element={<OmrPage />} />
          <Route path="access" element={<AccessControlPage />} />
          <Route path="students" element={<StudentManagementPage />} />
          <Route path="analytics/ds" element={<AdvancedAnalyticsPage />} />
          <Route path="feedbacks" element={<AdminFeedbacksPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="settings" element={<SystemSettingsPage />} />
        </Route>
      </Route>

      {/* Student Routes */}
      <Route element={<ProtectedRoute allowedRoles={["STUDENT"]} />}>
        <Route
          path="/student"
          element={
            <StudentShell>
              <Outlet />
            </StudentShell>
          }
        >
          <Route index element={<StudentHomePage />} />
          <Route path="profile" element={<StudentDetailPage />} />
          <Route path="compare" element={<StudentComparePage />} />
        </Route>
        <Route path="/exam/:id/session" element={<StudentExamShell />} />
        <Route path="/student/exam/:examId/result" element={
          <StudentShell backTo="/student" backLabel="Trang chủ">
            <StudentExamResultPage />
          </StudentShell>
        } />
      </Route>

      {/* Fallback */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <ToastProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </BrowserRouter>
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
