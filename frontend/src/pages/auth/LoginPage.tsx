import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../../components/layout/AuthShell';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../stores/authStore';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login({ username, password });
      navigate('/admin');
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Đăng nhập</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Nhập tên đăng nhập và mật khẩu để tiếp tục
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-500 text-sm">
            {error}
          </div>
        )}

        <Input
          label="Tên đăng nhập hoặc Email"
          placeholder="admin"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
        />

        <Input
          label="Mật khẩu"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button type="submit" isLoading={isLoading} className="w-full">
          Đăng nhập
        </Button>

        <p className="text-center text-sm text-neutral-500">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-primary-500 hover:text-primary-700 font-medium">
            Đăng ký
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
