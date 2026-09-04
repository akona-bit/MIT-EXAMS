import { type ReactNode } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AlertProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const ICON_MAP = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLOR_MAP = {
  success: 'bg-success-500/10 border-success-500/20 text-success-600 dark:text-success-400',
  error: 'bg-danger-500/10 border-danger-500/20 text-danger-600 dark:text-danger-400',
  warning: 'bg-warning-500/10 border-warning-500/20 text-warning-600 dark:text-warning-400',
  info: 'bg-info-500/10 border-info-500/20 text-info-600 dark:text-info-400',
};

const ICON_COLOR_MAP = {
  success: 'text-success-500',
  error: 'text-danger-500',
  warning: 'text-warning-500',
  info: 'text-info-500',
};

export default function Alert({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  className,
}: AlertProps) {
  const Icon = ICON_MAP[variant];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md',
        COLOR_MAP[variant],
        className
      )}
      role="alert"
    >
      <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', ICON_COLOR_MAP[variant])} />
      <div className="flex-1 min-w-0">
        {title && (
          <p className="text-sm font-semibold mb-0.5">{title}</p>
        )}
        <div className="text-sm opacity-90">{children}</div>
      </div>
      {dismissible && (
        <button
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
