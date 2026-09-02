import { useState, useEffect } from "react";
import { getUsers, updateUserAccess, inviteUser, type UserAccess } from "../../api/admin";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";

export default function AccessControlPage() {
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Invite User state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState("STUDENT");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");

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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setInviteMessage("");
    setInviteError("");
    try {
      const emailList = inviteEmail
        .split(/[,;\n]+/)
        .map(email => email.trim())
        .filter(email => email.length > 0);
        
      if (emailList.length === 0) {
        throw new Error("Vui lòng nhập ít nhất một email hợp lệ.");
      }
      
      const res = await inviteUser({
        emails: emailList,
        full_name: inviteFullName,
        role_name: inviteRole,
      });
      setInviteMessage(res.message || "Đã gửi lời mời thành công!");
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("STUDENT");
      // Reload user list
      loadUsers();
      setTimeout(() => {
        setIsInviteModalOpen(false);
        setInviteMessage("");
      }, 2000);
    } catch (err: any) {
      setInviteError(err.response?.data?.detail || "Lỗi khi gửi lời mời.");
    } finally {
      setIsInviting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-neutral-500">Đang tải danh sách...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">
            Quản lý quyền xem đáp án
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Quản lý quyền xem đáp án và mời người dùng mới vào hệ thống.
          </p>
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)}>
          + Mời người dùng
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-700">
          {error}
        </div>
      )}

      <div className="p-0 overflow-hidden glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Tên người dùng</th>
                <th className="px-6 py-4 font-semibold">Trạng thái quyền</th>
                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 dark:divide-white/5">
              {users.map((user) => (
                <tr key={user.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all duration-200">
                  <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{user.id}</td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{user.email}</td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{user.username || "-"}</td>
                  <td className="px-6 py-4">
                    {user.can_view_answers ? (
                      <span className="inline-flex rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-semibold text-success-600 dark:text-success-400">
                        Đã cấp quyền
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Chưa cấp
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => toggleAccess(user.id, user.can_view_answers)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        user.can_view_answers 
                          ? "bg-danger-50 text-danger-700 hover:bg-danger-100 dark:bg-danger-500/10 dark:text-danger-400 dark:hover:bg-danger-500/20" 
                          : "bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-500/10 dark:text-primary-400 dark:hover:bg-primary-500/20"
                      }`}
                    >
                      {user.can_view_answers ? "Thu hồi quyền" : "Cấp quyền"}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    Không có người dùng nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => !isInviting && setIsInviteModalOpen(false)}
        title="Mời người dùng bằng Gmail"
      >
        <form onSubmit={handleInvite} className="space-y-4 mt-4">
          {inviteMessage && (
            <div className="rounded-lg bg-success-50 p-4 text-sm text-success-700">
              {inviteMessage}
            </div>
          )}
          {inviteError && (
            <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-700">
              {inviteError}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Danh sách Email (ngăn cách bởi dấu phẩy, chấm phẩy hoặc xuống dòng)
            </label>
            <textarea
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="nguyenvana@gmail.com, nguyenvanb@gmail.com"
              rows={3}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <Input
            label="Họ và tên"
            value={inviteFullName}
            onChange={(e) => setInviteFullName(e.target.value)}
            placeholder="Nguyễn Văn A"
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Phân quyền
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="STUDENT">Học sinh (Student)</option>
              <option value="TEACHER">Giáo viên (Teacher)</option>
              <option value="ADMIN">Quản trị viên (Admin)</option>
            </select>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsInviteModalOpen(false)}
              disabled={isInviting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isInviting}>
              {isInviting ? "Đang gửi..." : "Gửi lời mời"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
