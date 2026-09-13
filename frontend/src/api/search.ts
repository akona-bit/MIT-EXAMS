import client from './client';

export interface SearchResult {
  exams: ExamSearchResult[];
  students: StudentSearchResult[];
  query: string;
}

export interface ExamSearchResult {
  id: number;
  name: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  submission_count: number;
  form_codes: string[];
}

export interface StudentSearchResult {
  user_id: number;
  full_name: string | null;
  exams: StudentExamSearch[];
}

export interface StudentExamSearch {
  exam_id: number;
  exam_name: string;
  exam_code: string | null;
  attempt_number: number;
  status: string;
  score: number | null;
  max_score: number;
  date: string;
  rank: number | null;
}

export const searchApi = {
  search: async (query: string): Promise<SearchResult> => {
    const response = await client.get('/api/v1/search/', { params: { q: query } });
    return response.data;
  }
};
