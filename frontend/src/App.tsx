import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./stores/authStore";
import { ThemeProvider } from "./stores/themeStore";
// Layouts
import AdminShell from "./components/layout/AdminShell";

// Pages
import LoginPage from "./pages/auth/LoginPage";
import GuestPage from "./pages/auth/GuestPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import DashboardPage from "./pages/admin/DashboardPage";
import PassagesPage from "./pages/admin/PassagesPage";
import PassageFormPage from "./pages/admin/PassageFormPage";
import QuestionsPage from "./pages/admin/QuestionsPage";
import QuestionFormPage from "./pages/admin/QuestionFormPage";
import PassageGroupWizard from "./components/admin/passage/PassageGroupWizard";
import MatrixPage from "./pages/admin/MatrixPage";
import MatrixFormPage from "./pages/admin/MatrixFormPage";
import MatrixDetailPage from "./pages/admin/MatrixDetailPage";
import ExamsPage from "./pages/admin/ExamsPage";
import ExamDetailPage from "./pages/admin/ExamDetailPage";
import ExamFormPage from "./pages/admin/ExamFormPage";
import StudentHomePage from "./pages/student/StudentHomePage";
import StudentExamShell from "./pages/student/StudentExamShell";
import StudentExamResultPage from "./pages/student/StudentExamResultPage";

import ObsidianPage from "./pages/admin/ObsidianPage";
import ResourcesPage from "./pages/admin/ResourcesPage";
import AccessControlPage from "./pages/admin/AccessControlPage";

import StudentManagementPage from "./pages/admin/analytics/StudentManagementPage";
import StudentDetailPage from "./pages/admin/analytics/StudentDetailPage";
import StudentComparePage from "./pages/admin/analytics/StudentComparePage";
import AdvancedAnalyticsPage from "./pages/admin/analytics/AdvancedAnalyticsPage";
import FraudDetectionPage from "./pages/admin/analytics/FraudDetectionPage";
import ExamComparePage from "./pages/admin/ExamComparePage";
import SystemSettingsPage from "./pages/admin/settings/SystemSettingsPage";

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
          <Route path="passages" element={<PassagesPage />} />
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
          <Route path="exams/compare" element={<ExamComparePage />} />
          <Route path="exams/:id" element={<ExamDetailPage />} />
          <Route path="obsidian" element={<ObsidianPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="access" element={<AccessControlPage />} />
          <Route path="students" element={<StudentManagementPage />} />
          <Route path="students/compare" element={<StudentComparePage />} />
          <Route path="students/:id" element={<StudentDetailPage />} />
          <Route path="analytics/ds" element={<AdvancedAnalyticsPage />} />
          <Route path="analytics/fraud" element={<FraudDetectionPage />} />
          <Route path="settings" element={<SystemSettingsPage />} />
        </Route>
      </Route>

      {/* Student Routes */}
      <Route element={<ProtectedRoute allowedRoles={["STUDENT"]} />}>
        <Route path="/student" element={<StudentHomePage />} />
        <Route path="/exam/:id/session" element={<StudentExamShell />} />
        <Route path="/student/exam/:examId/result" element={<StudentExamResultPage />} />
      </Route>

      {/* Fallback */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
