import { useState, useEffect } from "react";
import { getSystemSettings, updateSystemSetting, type SystemSetting } from "../../../api/admin";

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const loadSettings = async () => {
    try {
      const data = await getSystemSettings();
      setSettings(data);
    } catch (err) {
      setError("Không thể tải cài đặt hệ thống.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const getSettingValue = (key: string, defaultValue = "false") => {
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value.toLowerCase() === "true" : defaultValue === "true";
  };

  const handleToggle = async (key: string, currentValue: boolean, description: string) => {
    setSaving(true);
    setSaveMessage("");
    setError("");
    try {
      const newValue = !currentValue ? "true" : "false";
      const updated = await updateSystemSetting(key, newValue, description);
      setSettings(settings.map(s => s.key === key ? updated : s));
      // If the setting didn't exist before, it won't be mapped. Just reload.
      if (!settings.find(s => s.key === key)) {
        loadSettings();
      }
      setSaveMessage("Cập nhật cài đặt thành công.");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (err) {
      setError("Không thể cập nhật cài đặt.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-neutral-500">Đang tải cài đặt...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">
            Cài đặt hệ thống
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Cấu hình các tham số hoạt động chung và thông báo bảo trì.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-700">
          {error}
        </div>
      )}
      {saveMessage && (
        <div className="rounded-lg bg-success-50 p-4 text-sm text-success-700">
          {saveMessage}
        </div>
      )}

      <div className="space-y-6">
        <div className="p-6 glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-2xl">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Chế độ Bảo trì (Maintenance Mode)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Khi bật, học sinh sẽ không thể truy cập vào các tính năng tương ứng. Không ảnh hưởng đến Giáo viên và Quản trị viên.
          </p>

          <div className="space-y-4">
            <ToggleSetting 
              title="Bảo trì toàn bộ hệ thống" 
              description="Ngăn chặn học sinh truy cập vào bất kỳ trang nào của hệ thống."
              checked={getSettingValue("maintenance_mode_all")}
              onChange={(checked) => handleToggle("maintenance_mode_all", !checked, "Bảo trì toàn bộ hệ thống")}
              disabled={saving}
            />
            <ToggleSetting 
              title="Bảo trì phòng thi" 
              description="Ngăn chặn học sinh bắt đầu kỳ thi hoặc vào phòng thi."
              checked={getSettingValue("maintenance_mode_exam")}
              onChange={(checked) => handleToggle("maintenance_mode_exam", !checked, "Bảo trì phòng thi")}
              disabled={saving}
            />
            <ToggleSetting 
              title="Bảo trì kết quả/phân tích" 
              description="Ngăn chặn học sinh xem kết quả bài thi."
              checked={getSettingValue("maintenance_mode_result")}
              onChange={(checked) => handleToggle("maintenance_mode_result", !checked, "Bảo trì kết quả/phân tích")}
              disabled={saving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSetting({ title, description, checked, onChange, disabled }: { title: string, description: string, checked: boolean, onChange: (checked: boolean) => void, disabled: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-white/5">
      <div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}
