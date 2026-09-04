import client from './client';

export interface FeedbackUser {
  id: number;
  username: string;
}

export interface AdminFeedback {
  id: number;
  user_id: number;
  category: string;
  content: string;
  status: string;
  context_data?: Record<string, any>;
  created_at: string;
  updated_at?: string;
  user?: FeedbackUser;
}

export interface AdminFeedbacksResponse {
  total: number;
  items: AdminFeedback[];
}

export interface FeedbackStats {
  total: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
}

export const adminFeedbacksApi = {
  getAll: async (skip = 0, limit = 50, status?: string, category?: string, search?: string): Promise<AdminFeedbacksResponse> => {
    let url = `/api/v1/admin/feedbacks?skip=${skip}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    if (category) url += `&category=${category}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const response = await client.get<AdminFeedbacksResponse>(url);
    return response.data;
  },

  getStats: async (): Promise<FeedbackStats> => {
    const response = await client.get<FeedbackStats>('/api/v1/admin/feedbacks/stats');
    return response.data;
  },

  getById: async (id: number): Promise<AdminFeedback> => {
    const response = await client.get<AdminFeedback>(`/api/v1/admin/feedbacks/${id}`);
    return response.data;
  },

  updateStatus: async (id: number, status: string): Promise<void> => {
    await client.put(`/api/v1/admin/feedbacks/${id}/status`, { status });
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/api/v1/admin/feedbacks/${id}`);
  },
};
