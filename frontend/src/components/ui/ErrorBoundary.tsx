import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-500/10 mb-5">
            <AlertTriangle className="h-8 w-8 text-danger-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {this.props.fallbackTitle || 'Đã xảy ra lỗi'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md mb-2">
            {this.props.fallbackMessage || 'Trang này gặp sự cố không mong muốn.'}
          </p>
          {this.state.error && (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center max-w-lg mb-6 font-mono bg-slate-100 dark:bg-slate-800 rounded-lg px-4 py-2">
              {this.state.error.message}
            </p>
          )}
          <div className="flex gap-3">
            <Button onClick={this.handleReset} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Thử lại
            </Button>
            <Button onClick={() => window.location.href = '/'} size="sm">
              Về trang chủ
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
