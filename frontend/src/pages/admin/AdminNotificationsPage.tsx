import { useState, useEffect } from "react";
import { Bell, Send, Users, User, Trash2, CheckCircle, Info, FileText, Star, MessageSquare, Inbox } from "lucide-react";
import { Card } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Textarea from "../../components/ui/Textarea";
import { Badge } from "../../components/ui/Badge";
import { toast } from "../../components/ui/Toast";
import { getNotifications, sendNotification, markAllRead, deleteNotification, type NotificationItem } from "../../api/notifications";
import client from "../../api/client";

const TYPE_OPTIONS = [
  { value: "SYSTEM", label: "Hệ thống" },
  { value: "EXAM", label: "Kỳ thi" },
  { value: "GRADING", label: "Chấm điểm" },
  { value: "FEEDBACK", label: "Góp ý" },
  { value: "OTHER", label: "Khác" },
];

const TYPE_ICON: Record<string, typeof Bell> = {
  SYSTEM: Info,
  EXAM: FileText,
  GRADING: Star,
  FEEDBACK: MessageSquare,
  OTHER: Bell,
};

const TYPE_COLOR: Record<string, string> = {
  SYSTEM: "info",
  EXAM: "default",
  GRADING: "success",
  FEEDBACK: "warning",
  OTHER: "secondary",
};

interface UserOption {
  id: number;
  username: string;
  full_name?: string;
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  // Form state
  const [sendTo, setSendTo] = useState<"user" | "role" | "all">("all");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState("STUDENT");
  const [notifType, setNotifType] = useState("SYSTEM");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => {
    loadNotifications();
    loadUsers();
  }, []);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const data = await getNotifications(0, 50);
      setNotifications(data.items);
      setTotal(data.total);
    } catch {
      toast.error("Không thể tải danh sách thông báo");
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data } = await client.get("/api/v1/users/", { params: { skip: 0, limit: 200 } });
      setUsers(data.items || data);
    } catch {
      // silent
    }
  };

  const handleSend = async () => {
    if (!title.trim()) {
      toast.warning("Vui lòng nhập tiêu đề");
      return;
    }
    if (!message.trim()) {
      toast.warning("Vui lòng nhập nội dung");
      return;
    }

    setIsSending(true);
    try {
      const result = await sendNotification({
        recipient_id: sendTo === "user" ? selectedUserId ?? undefined : undefined,
        role_name: sendTo === "role" ? selectedRole : undefined,
        send_to_all: sendTo === "all",
        type: notifType,
        title: title.trim(),
        message: message.trim(),
        detail: detail.trim() || undefined,
        link: link.trim() || undefined,
      });
      toast.success(`Đã gửi thông báo đến ${result.count} người`);
      setTitle("");
      setMessage("");
      setDetail("");
      setLink("");
      loadNotifications();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Gửi thông báo thất bại");
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("Đã đánh dấu tất cả đã đọc");
    } catch {
      toast.error("Không thể cập nhật");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((prev) => prev - 1);
    } catch {
      toast.error("Không thể xóa");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient pb-1">Quản lý Thông báo</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Gửi và quản lý thông báo cho người dùng</p>
        </div>
        <Badge variant="info">{total} thông báo</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Send Form */}
        <div className="lg:col-span-1">
          <Card className="p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Send className="h-5 w-5 text-primary-500" />
              Gửi thông báo mới
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Gửi đến
                </label>
                <div className="flex gap-2">
                  {[
                    { value: "all", label: "Tất cả", icon: Users },
                    { value: "role", label: "Vai trò", icon: User },
                    { value: "user", label: "Cá nhân", icon: User },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setSendTo(value as typeof sendTo)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                        sendTo === value
                          ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {sendTo === "user" && (
                <Select
                  label="Chọn người nhận"
                  value={selectedUserId ?? ""}
                  onChange={(e) => setSelectedUserId(Number(e.target.value) || null)}
                  options={users.map((u) => ({
                    value: u.id,
                    label: u.full_name || u.username,
                  }))}
                  placeholder="Chọn người dùng..."
                />
              )}

              {sendTo === "role" && (
                <Select
                  label="Chọn vai trò"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  options={[
                    { value: "STUDENT", label: "Thí sinh" },
                    { value: "TEACHER", label: "Giáo viên" },
                    { value: "ADMIN", label: "Quản trị viên" },
                  ]}
                />
              )}

              <Select
                label="Loại thông báo"
                value={notifType}
                onChange={(e) => setNotifType(e.target.value)}
                options={TYPE_OPTIONS}
              />

              <Input
                label="Tiêu đề"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tiêu đề thông báo..."
              />

              <Textarea
                label="Nội dung"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Nhập nội dung thông báo..."
                rows={3}
              />

              <Input
                label="Chi tiết (tùy chọn)"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Thông tin thêm..."
              />

              <Input
                label="Link (tùy chọn)"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="/admin/exams"
              />

              <Button
                onClick={handleSend}
                isLoading={isSending}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                Gửi thông báo
              </Button>
            </div>
          </Card>
        </div>

        {/* Notification List */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary-500" />
                Lịch sử thông báo
              </h2>
              <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Đọc tất cả
              </Button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3 px-6 py-4">
                      <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                        <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Inbox className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Chưa có thông báo nào</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const Icon = TYPE_ICON[n.type] || Bell;
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        !n.is_read ? "bg-primary-50/30 dark:bg-primary-500/5" : ""
                      }`}
                    >
                      <div className={`shrink-0 mt-0.5 text-${TYPE_COLOR[n.type] || "slate"}-500`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm ${!n.is_read ? "font-semibold" : ""} text-slate-900 dark:text-white`}>
                            {n.title}
                          </p>
                          {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary-500" />}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">
                          {n.created_at ? new Date(n.created_at).toLocaleString("vi-VN") : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(n.id)}
                        className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
