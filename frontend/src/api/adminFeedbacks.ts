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

export const adminFeedbacksApi = {
  getAll: async (skip = 0, limit = 50, status?: string): Promise<AdminFeedbacksResponse> => {
    let url = `/api/v1/admin/feedbacks?skip=${skip}&limit=${limit}`;
    if (status) {
      url += `&status=${status}`;
    }
    const response = await client.get<AdminFeedbacksResponse>(url);
    return response.data;
  },

  updateStatus: async (id: number, status: string): Promise<void> => {
    await client.put(`/api/v1/admin/feedbacks/${id}/status`, { status });
  },
};
