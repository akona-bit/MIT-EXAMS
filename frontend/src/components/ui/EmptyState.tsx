import { type ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  message?: string;
  action?: ReactNode;
}

export default function EmptyState({
  icon,
  title = 'Không có dữ liệu',
  message = 'Chưa có dữ liệu nào để hiển thị.',
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 mb-5">
        {icon || <Inbox className="h-8 w-8 text-slate-400 dark:text-slate-500" />}
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md mb-6">{message}</p>
      {action}
    </div>
  );
}
