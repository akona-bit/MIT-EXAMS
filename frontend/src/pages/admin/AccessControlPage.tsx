import { useState, useEffect, useCallback } from "react";
import {
  getStudents,
  updateStudentAccess,
  getStaffMembers,
  inviteUser,
  type StudentItem,
  type StaffMember,
} from "../../api/admin";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";

type Tab = "students" | "staff";

const PAGE_SIZE = 20;

export default function AccessControlPage() {
  const [tab, setTab] = useState<Tab>("students");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gradient pb-1">
          Quản lý người dùng
        </h1>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
          Phân biệt rõ giữa Thí sinh và Giáo viên / Quản trị viên.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 w-fit">
        <button
          onClick={() => setTab("students")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            tab === "students"
              ? "bg-white dark:bg-slate-900 text-primary-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          Thí sinh
        </button>
        <button
          onClick={() => setTab("staff")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            tab === "staff"
              ? "bg-white dark:bg-slate-900 text-primary-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          Giáo viên / Quản trị viên
        </button>
      </div>

      {tab === "students" ? <StudentsTab /> : <StaffTab />}
    </div>
  );
}

/* ────────────── Thí sinh tab ────────────── */

function StudentsTab() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStudents({ skip: page * PAGE_SIZE, limit: PAGE_SIZE, search: search || undefined });
      setStudents(data.items);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const toggleAccess = async (userId: number, current: boolean) => {
    try {
      const result = await updateStudentAccess(userId, !current);
      setStudents((prev) =>
        prev.map((s) => (s.id === userId ? { ...s, can_view_answers: result.can_view_answers } : s))
      );
    } catch {
      alert("Không thể cập nhật quyền.");
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Tìm theo email, tên, SBD..."
          className="w-full max-w-sm rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <span className="text-xs text-slate-400 whitespace-nowrap">{total} thí sinh</span>
      </div>

      <div className="overflow-hidden glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3 font-semibold">SBD</th>
                <th className="px-4 py-3 font-semibold">Họ tên</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold text-center">Điểm TB</th>
                <th className="px-4 py-3 font-semibold text-center">Số bài thi</th>
                <th className="px-4 py-3 font-semibold">Quyền xem đáp án</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 dark:divide-white/5">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Đang tải...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Không có thí sinh nào.</td></tr>
              ) : students.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">{s.sbd || "-"}</td>
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{s.full_name || s.username}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.email}</td>
                  <td className="px-4 py-3 text-center">
                    {s.avg_score !== null ? (
                      <span className="font-semibold text-primary-600 dark:text-primary-400">{s.avg_score}</span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{s.exam_count}</td>
                  <td className="px-4 py-3">
                    {s.can_view_answers ? (
                      <span className="inline-flex rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-semibold text-success-600">Đã cấp</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-500">Chưa cấp</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleAccess(s.id, s.can_view_answers)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        s.can_view_answers
                          ? "bg-danger-50 text-danger-700 hover:bg-danger-100 dark:bg-danger-500/10 dark:text-danger-400"
                          : "bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-500/10 dark:text-primary-400"
                      }`}
                    >
                      {s.can_view_answers ? "Thu hồi" : "Cấp quyền"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Trước
          </Button>
          <span className="text-xs text-slate-500">
            Trang {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      )}
    </div>
  );
}

/* ────────────── Giáo viên / Admin tab ────────────── */

function StaffTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState("TEACHER");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStaffMembers({ skip: page * PAGE_SIZE, limit: PAGE_SIZE, search: search || undefined });
      setStaff(data.items);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setInviteMessage("");
    setInviteError("");
    try {
      const emailList = inviteEmail.split(/[,;\n]+/).map((e) => e.trim()).filter(Boolean);
      if (!emailList.length) throw new Error("Vui lòng nhập ít nhất một email hợp lệ.");
      const res = await inviteUser({ emails: emailList, full_name: inviteFullName, role_name: inviteRole });
      setInviteMessage(res.message || "Đã gửi lời mời!");
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("TEACHER");
      load();
      setTimeout(() => { setIsInviteModalOpen(false); setInviteMessage(""); }, 2000);
    } catch (err: any) {
      setInviteError(err.response?.data?.detail || err.message || "Lỗi gửi lời mời.");
    } finally {
      setIsInviting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Tìm theo email, tên..."
          className="w-full max-w-sm rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <span className="text-xs text-slate-400 whitespace-nowrap">{total} người</span>
        <div className="flex-1" />
        <Button onClick={() => setIsInviteModalOpen(true)}>+ Mời người dùng</Button>
      </div>

      <div className="overflow-hidden glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3 font-semibold">Họ tên</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Vai trò</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 dark:divide-white/5">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Đang tải...</td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Không có giáo viên/quản trị nào.</td></tr>
              ) : staff.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{u.full_name || u.username}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      u.role === "ADMIN"
                        ? "bg-danger-500/10 text-danger-600 dark:text-danger-400"
                        : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                    }`}>
                      {u.role === "ADMIN" ? "Quản trị" : "Giáo viên"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="inline-flex rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-semibold text-success-600">Hoạt động</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-500">Vô hiệu</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Trước</Button>
          <span className="text-xs text-slate-500">Trang {page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Sau</Button>
        </div>
      )}

      {/* Invite modal */}
      <Modal isOpen={isInviteModalOpen} onClose={() => !isInviting && setIsInviteModalOpen(false)} title="Mời người dùng bằng Gmail">
        <form onSubmit={handleInvite} className="space-y-4 mt-4">
          {inviteMessage && <div className="rounded-lg bg-success-50 p-4 text-sm text-success-700">{inviteMessage}</div>}
          {inviteError && <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-700">{inviteError}</div>}
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
          <Input label="Họ và tên" value={inviteFullName} onChange={(e) => setInviteFullName(e.target.value)} placeholder="Nguyễn Văn A" />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phân quyền</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="TEACHER">Giáo viên</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsInviteModalOpen(false)} disabled={isInviting}>Hủy</Button>
            <Button type="submit" disabled={isInviting}>{isInviting ? "Đang gửi..." : "Gửi lời mời"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
