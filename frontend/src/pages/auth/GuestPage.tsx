import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { updateMe } from "../../api/auth";

export default function GuestPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });
      
      if (otpError) throw otpError;
      
      setOtpStep(true);
    } catch (err: any) {
      setError(
        err.message || "Không thể gửi OTP. Vui lòng kiểm tra lại thông tin.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });
      
      if (verifyError) throw verifyError;
      
      // Wait for AuthProvider to sync context and set token
      // After login, we want to update the full name on our backend
      setTimeout(async () => {
        try {
          await updateMe(fullName);
        } catch (e) {
          console.error("Failed to update guest full name", e);
        }
        navigate("/student");
      }, 1500);
    } catch (err: any) {
      setError("Mã OTP không đúng hoặc đã hết hạn.");
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
          
          {otpStep ? (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Xác thực OTP</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Mã xác thực đã được gửi tới email <span className="font-semibold">{email}</span>
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-500 text-sm">
                  {error}
                </div>
              )}

              <Input
                label="Mã OTP"
                placeholder="Nhập 6 số"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                autoFocus
                maxLength={6}
              />

              <Button type="submit" isLoading={isLoading} className="w-full">
                Xác nhận
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => setOtpStep(false)} className="text-sm text-primary-500 hover:underline">
                  Quay lại
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Đăng nhập Nhanh</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Dành cho thí sinh chưa có tài khoản. Mã OTP sẽ được gửi về email của bạn.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-500 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSendOtp} className="space-y-4">
                <Input
                  label="Họ và Tên"
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoFocus
                />
                
                <Input
                  label="Email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Button type="submit" isLoading={isLoading} className="w-full">
                  Gửi mã OTP
                </Button>
              </form>

              <div className="relative flex items-center justify-center mt-6">
                <div className="absolute border-t border-slate-200 dark:border-slate-800 w-full"></div>
                <div className="relative bg-white dark:bg-slate-900 px-4 text-xs text-slate-500">Hoặc</div>
              </div>

              <div className="pt-2 text-center">
                <Link to="/login" className="inline-block px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors">
                  Quay lại trang Đăng nhập
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
