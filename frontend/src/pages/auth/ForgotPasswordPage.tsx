import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { sendResetPassword, resetPassword } from "../../api/auth";

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const codeParam = searchParams.get("code") || "";
  
  const isResetMode = !!(emailParam && codeParam);
  
  const [email, setEmail] = useState(emailParam);
  const [code] = useState(codeParam);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isResetDone, setIsResetDone] = useState(false);
  
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await sendResetPassword(email);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Không thể gửi yêu cầu đặt lại mật khẩu.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    
    if (newPassword.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(email, code, newPassword);
      setIsResetDone(true);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Đặt lại mật khẩu thất bại.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isResetDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="relative w-full max-w-5xl mx-auto px-4 py-12 flex flex-col items-center">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-8 w-full max-w-md">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 text-green-500 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Đặt lại mật khẩu thành công</h2>
              <div className="pt-4">
                <Link to="/login" className="inline-block px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors">
                  Đăng nhập ngay
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isResetMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="relative w-full max-w-5xl mx-auto px-4 py-12 flex flex-col items-center">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl shadow-lg mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Đặt lại Mật khẩu</h1>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-8 w-full max-w-md">
            <form onSubmit={handleResetPassword} className="space-y-5">
              <p className="text-sm text-slate-500">
                Nhập mật khẩu mới cho tài khoản <span className="font-semibold">{email}</span>
              </p>

              {error && (
                <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-500 text-sm">
                  {error}
                </div>
              )}

              <Input
                label="Mật khẩu mới"
                type="password"
                placeholder="Ít nhất 6 ký tự"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
              />

              <Input
                label="Xác nhận mật khẩu"
                type="password"
                placeholder="Nhập lại mật khẩu"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <Button type="submit" isLoading={isLoading} className="w-full">
                Đặt lại mật khẩu
              </Button>

              <div className="pt-2 text-center">
                <Link to="/login" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors">
                  Quay lại trang Đăng nhập
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

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
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Quên Mật Khẩu</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Lấy lại quyền truy cập vào tài khoản của bạn</p>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-white/60 dark:border-white/10 p-8 animate-in slide-in-from-bottom-4 duration-500 w-full max-w-md mb-12">
          
          {isSubmitted ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 text-green-500 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Kiểm tra Email</h2>
              <p className="text-sm text-slate-500">
                Chúng tôi đã gửi một đường link đặt lại mật khẩu tới <span className="font-semibold">{email}</span>. Vui lòng kiểm tra hộp thư đến của bạn.
              </p>
              <div className="pt-4">
                <Link to="/login" className="inline-block px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors">
                  Quay lại Đăng nhập
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="text-sm text-slate-500">
                  Nhập email được liên kết với tài khoản của bạn, chúng tôi sẽ gửi một liên kết để đặt lại mật khẩu.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-500 text-sm">
                  {error}
                </div>
              )}

              <Input
                label="Email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />

              <Button type="submit" isLoading={isLoading} className="w-full">
                Gửi liên kết
              </Button>

              <div className="pt-2 text-center">
                <Link to="/login" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors">
                  Quay lại trang Đăng nhập
                </Link>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
