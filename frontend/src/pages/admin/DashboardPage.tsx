import { useAuth } from '../../stores/authStore';

export default function DashboardPage() {
  const { user } = useAuth();

  const stats = [
    { label: 'Tổng câu hỏi', value: '—', icon: '📝', color: 'bg-primary-50 text-primary-500' },
    { label: 'Kỳ thi đã tạo', value: '—', icon: '📋', color: 'bg-green-50 text-success-500' },
    { label: 'Thí sinh', value: '—', icon: '👥', color: 'bg-orange-50 text-warning-500' },
    { label: 'Bài đã chấm', value: '—', icon: '✅', color: 'bg-blue-50 text-info-500' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Xin chào, {user?.username || 'Admin'} 👋
        </h1>
        <p className="text-neutral-500 mt-1">
          Tổng quan hoạt động hệ thống MIT EXAMS
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-neutral-200/60 p-5 hover:shadow-md transition-shadow duration-300"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${s.color}`}>
                {s.icon}
              </div>
              <div>
                <p className="text-sm text-neutral-500">{s.label}</p>
                <p className="text-2xl font-bold text-neutral-900 mt-0.5">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart placeholder */}
        <div className="bg-white rounded-xl border border-neutral-200/60 p-6">
          <h3 className="text-base font-semibold text-neutral-900 mb-4">Phổ điểm gần đây</h3>
          <div className="h-48 flex items-center justify-center bg-neutral-50 rounded-lg border border-dashed border-neutral-300">
            <p className="text-sm text-neutral-400">Biểu đồ sẽ hiển thị khi có dữ liệu kỳ thi</p>
          </div>
        </div>

        {/* Recent exams placeholder */}
        <div className="bg-white rounded-xl border border-neutral-200/60 p-6">
          <h3 className="text-base font-semibold text-neutral-900 mb-4">Kỳ thi gần đây</h3>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50">
                <div className="w-2 h-2 rounded-full bg-neutral-300" />
                <div className="flex-1">
                  <div className="h-3 w-3/4 bg-neutral-200 rounded animate-pulse" />
                  <div className="h-2 w-1/2 bg-neutral-100 rounded mt-2 animate-pulse" />
                </div>
              </div>
            ))}
            <p className="text-xs text-neutral-400 text-center pt-2">
              Tạo kỳ thi đầu tiên tại mục "Kỳ thi"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
