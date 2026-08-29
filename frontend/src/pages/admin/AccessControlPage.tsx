import { useState, useEffect } from "react";
import { getUsers, updateUserAccess, type UserAccess } from "../../api/admin";

export default function AccessControlPage() {
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      setError("Không thể tải danh sách người dùng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleAccess = async (userId: number, currentAccess: boolean) => {
    try {
      const result = await updateUserAccess(userId, !currentAccess);
      setUsers(users.map(u => u.id === userId ? { ...u, can_view_answers: result.can_view_answers } : u));
    } catch (err) {
      alert("Không thể cập nhật quyền. Vui lòng thử lại.");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-neutral-500">Đang tải danh sách...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Quản lý quyền xem đáp án
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Cấp quyền cho thí sinh được phép xem đáp án và giải thích chi tiết.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-left text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 font-semibold text-neutral-900">ID</th>
                <th className="px-6 py-3 font-semibold text-neutral-900">Email</th>
                <th className="px-6 py-3 font-semibold text-neutral-900">Tên người dùng</th>
                <th className="px-6 py-3 font-semibold text-neutral-900">Trạng thái quyền</th>
                <th className="px-6 py-3 font-semibold text-neutral-900 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {users.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-neutral-900">{user.id}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-neutral-600">{user.email}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-neutral-600">{user.username || "-"}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {user.can_view_answers ? (
                      <span className="inline-flex rounded-full bg-success-50 px-2 text-xs font-semibold leading-5 text-success-700">
                        Đã cấp quyền
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-neutral-100 px-2 text-xs font-semibold leading-5 text-neutral-600">
                        Chưa cấp
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <button
                      onClick={() => toggleAccess(user.id, user.can_view_answers)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        user.can_view_answers 
                          ? "bg-danger-50 text-danger-700 hover:bg-danger-100" 
                          : "bg-primary-50 text-primary-700 hover:bg-primary-100"
                      }`}
                    >
                      {user.can_view_answers ? "Thu hồi quyền" : "Cấp quyền"}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                    Không có người dùng nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
