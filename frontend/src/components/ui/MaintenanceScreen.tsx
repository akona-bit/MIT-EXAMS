import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "./Button";

interface MaintenanceScreenProps {
  title?: string;
  message?: string;
}

export default function MaintenanceScreen({ 
  title = "Hệ thống đang bảo trì", 
  message = "Chúng tôi đang tiến hành nâng cấp hệ thống. Vui lòng quay lại sau." 
}: MaintenanceScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full glass-card p-8 rounded-2xl shadow-xl text-center space-y-6">
        <div className="mx-auto w-20 h-20 bg-warning-100 dark:bg-warning-900/30 text-warning-500 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-10 h-10" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {title}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {message}
          </p>
        </div>
        
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Tải lại trang
          </Button>
          <div className="mt-4">
            <Link to="/login" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
              Quay lại trang đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
