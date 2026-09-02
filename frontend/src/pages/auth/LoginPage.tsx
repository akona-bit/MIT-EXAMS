import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useAuth } from "../../stores/authStore";
import { resolveSBD } from "../../api/auth";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleResolveIdentifier = async (ident: string) => {
    // If it's a 6-digit number, assume SBD
    if (/^\d{6}$/.test(ident)) {
      try {
        const res = await resolveSBD(ident);
        return res.email;
      } catch (e: any) {
        throw new Error("Số báo danh không tồn tại");
      }
    }
    return ident;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const emailToUse = await handleResolveIdentifier(identifier);
      const user = await login({ username: emailToUse, password });
      const targetRoute = user.role?.name === "STUDENT" ? "/student" : "/admin";
      navigate(targetRoute);
    } catch (err: any) {
      setError(
        err.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-300/20 dark:bg-primary-500/10 rounded-full blur-3xl animate-in fade-in duration-1000" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-500/10 dark:bg-primary-700/10 rounded-full blur-3xl animate-in fade-in duration-1000 delay-300" />
      </div>

      <div className="relative w-full max-w-5xl mx-auto px-4 py-12 flex flex-col items-center">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl shadow-lg mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">MIT EXAMS</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Hệ thống Quản lý Thi Trắc nghiệm</p>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-white/60 dark:border-white/10 p-8 animate-in slide-in-from-bottom-4 duration-500 w-full max-w-md mb-12">
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Đăng nhập</h2>
              <p className="text-sm text-slate-500 mt-1">
                Nhập thông tin tài khoản để đăng nhập
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-500 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email hoặc Số báo danh"
                placeholder="Ví dụ: admin@example.com hoặc 123456"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
              />

              <div className="space-y-1">
                <Input
                  label="Mật khẩu"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-xs text-primary-500 hover:underline">
                    Quên mật khẩu?
                  </Link>
                </div>
              </div>

              <Button type="submit" isLoading={isLoading} className="w-full">
                Đăng nhập
              </Button>
            </form>

            <div className="relative flex items-center justify-center mt-6">
              <div className="absolute border-t border-slate-200 dark:border-slate-800 w-full"></div>
              <div className="relative bg-white dark:bg-slate-900 px-4 text-xs text-slate-500">Hoặc</div>
            </div>

            <div className="pt-2 text-center">
              <Link to="/guest" className="inline-block px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors">
                Vào thi dưới tư cách Khách (Guest)
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
