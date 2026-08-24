import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../../components/layout/AuthShell';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { register } from '../../api/auth';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        username,
        email,
        password,
        role_id: 4, // Default: STUDENT role
      });
      navigate('/login');
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 'Đăng ký thất bại. Vui lòng thử lại.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Tạo tài khoản</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Đăng ký tài khoản thí sinh để tham gia kỳ thi
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-500 text-sm">
            {error}
          </div>
        )}

        <Input
          label="Tên đăng nhập"
          placeholder="nguyenvana"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
        />

        <Input
          label="Email"
          type="email"
          placeholder="example@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          label="Mật khẩu"
          type="password"
          placeholder="Tối thiểu 6 ký tự"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
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
          Đăng ký
        </Button>

        <p className="text-center text-sm text-neutral-500">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-primary-500 hover:text-primary-700 font-medium">
            Đăng nhập
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
