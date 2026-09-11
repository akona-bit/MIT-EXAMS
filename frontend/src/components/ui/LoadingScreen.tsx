import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingScreen({ message = "Đang tải...", fullScreen = true }: LoadingScreenProps) {
  const containerClass = fullScreen 
    ? "min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950" 
    : "flex flex-col items-center justify-center py-16 w-full";

  return (
    <div className={containerClass}>
      <Loader2 className="h-8 w-8 animate-spin text-primary-500 mb-3" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {message}
      </p>
    </div>
  );
}
