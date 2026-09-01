import api from './client';
import { Passage, Question, QuestionCreate } from '../types';

export interface PassageSearchResponse {
  results: {
    id: number;
    public_code: string;
    preview: string;
    source_title?: string | null;
    question_count: number;
  }[];
}

export interface PassageCreate {
  content: string;
  source_author?: string | null;
  source_title?: string | null;
}

export interface PassageUpdate {
  content?: string;
  source_author?: string | null;
  source_title?: string | null;
}

export interface QuestionBulkUpdateItem extends QuestionCreate {
  public_code?: string;
}

export const passageApi = {
  search: async (q: string = "", limit: number = 10) => {
    const response = await api.get<PassageSearchResponse>('/api/v1/passages/search', { params: { q, limit } });
    return response.data;
  },
  
  getByCode: async (code: string) => {
    const response = await api.get<Passage>(`/api/v1/passages/${code}`);
    return response.data;
  },
  
  create: async (data: PassageCreate) => {
    const response = await api.post<Passage>('/api/v1/passages/', data);
    return response.data;
  },
  
  update: async (code: string, data: PassageUpdate) => {
    const response = await api.patch<Passage>(`/api/v1/passages/${code}`, data);
    return response.data;
  },
  
  bulkCreateQuestions: async (code: string, questions: QuestionCreate[]) => {
    const response = await api.post<string[]>(`/api/v1/passages/${code}/questions/bulk`, { questions });
    return response.data;
  },
  
  bulkUpdateQuestions: async (code: string, questions: QuestionBulkUpdateItem[]) => {
    const response = await api.put<string[]>(`/api/v1/passages/${code}/questions/bulk`, { questions });
    return response.data;
  }
};
