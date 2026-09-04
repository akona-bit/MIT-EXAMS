import client from "./client";

export interface NotificationItem {
  id: number;
  type: "SYSTEM" | "EXAM" | "GRADING" | "FEEDBACK" | "OTHER";
  title: string;
  message: string;
  detail?: string;
  link?: string;
  is_read: boolean;
  created_at?: string;
  sender_name?: string;
}

export interface SendNotificationPayload {
  recipient_id?: number;
  role_name?: string;
  send_to_all?: boolean;
  type?: string;
  title: string;
  message: string;
  detail?: string;
  link?: string;
}

export async function getNotifications(skip = 0, limit = 20, unreadOnly = false): Promise<{ total: number; items: NotificationItem[] }> {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  if (unreadOnly) params.append("unread_only", "true");
  const { data } = await client.get(`/api/v1/notifications/?${params}`);
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await client.get("/api/v1/notifications/unread-count");
  return data.count;
}

export async function markAsRead(id: number): Promise<void> {
  await client.put(`/api/v1/notifications/${id}/read`);
}

export async function markAllRead(): Promise<void> {
  await client.put("/api/v1/notifications/read-all");
}

export async function deleteNotification(id: number): Promise<void> {
  await client.delete(`/api/v1/notifications/${id}`);
}

export async function sendNotification(payload: SendNotificationPayload): Promise<{ message: string; count: number }> {
  const { data } = await client.post("/api/v1/notifications/send", payload);
  return data;
}
