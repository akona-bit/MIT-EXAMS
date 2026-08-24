import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./stores/authStore";

// Layouts
import AdminShell from "./components/layout/AdminShell";

// Pages
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import DashboardPage from "./pages/admin/DashboardPage";
import QuestionsPage from "./pages/admin/QuestionsPage";
import QuestionFormPage from "./pages/admin/QuestionFormPage";
import MatrixPage from "./pages/admin/MatrixPage";
import ExamsPage from "./pages/admin/ExamsPage";
import ExamDetailPage from "./pages/admin/ExamDetailPage";
import StudentHomePage from "./pages/student/StudentHomePage";

import ObsidianPage from "./pages/admin/ObsidianPage";

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
        <Route path="/register" element={<RegisterPage />} />
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
          <Route path="questions" element={<QuestionsPage />} />
          <Route path="questions/new" element={<QuestionFormPage />} />
          <Route path="matrix" element={<MatrixPage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="exams/:id" element={<ExamDetailPage />} />
          <Route path="obsidian" element={<ObsidianPage />} />
        </Route>
      </Route>

      {/* Student Routes */}
      <Route element={<ProtectedRoute allowedRoles={["STUDENT"]} />}>
        <Route path="/student" element={<StudentHomePage />} />
        {/* Add more student routes here later */}
      </Route>

      {/* Fallback */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
