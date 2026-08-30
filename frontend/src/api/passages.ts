import api from './client';
import { Passage, Question, QuestionCreate } from '../types';

export interface PassageSearchResponse {
  results: {
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
  search: (q: string = "", limit: number = 10) => {
    return api.get<PassageSearchResponse>('/passages/search', { params: { q, limit } });
  },
  
  getByCode: (code: string) => {
    return api.get<Passage>(`/passages/${code}`);
  },
  
  create: (data: PassageCreate) => {
    return api.post<Passage>('/passages/', data);
  },
  
  update: (code: string, data: PassageUpdate) => {
    return api.patch<Passage>(`/passages/${code}`, data);
  },
  
  bulkCreateQuestions: (code: string, questions: QuestionCreate[]) => {
    return api.post<string[]>(`/passages/${code}/questions/bulk`, { questions });
  },
  
  bulkUpdateQuestions: (code: string, questions: QuestionBulkUpdateItem[]) => {
    return api.put<string[]>(`/passages/${code}/questions/bulk`, { questions });
  }
};
