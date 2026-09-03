import { apiClient } from './client';

export interface FeedbackCreate {
  category: 'BUG' | 'EXAM_CONTENT' | 'OTHER';
  content: string;
  context_data?: Record<string, any>;
}

export interface FeedbackResponse {
  id: number;
  user_id: number;
  category: string;
  content: string;
  status: string;
  context_data?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export const studentFeedbacksApi = {
  create: async (data: FeedbackCreate): Promise<FeedbackResponse> => {
    const response = await apiClient.post<FeedbackResponse>('/feedbacks/', data);
    return response.data;
  },
};
