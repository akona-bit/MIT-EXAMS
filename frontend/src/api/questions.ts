import client from './client';
import type { Question, QuestionCreate, PaginatedResponse } from '../types';

export async function getQuestions(
  skip: number = 0,
  limit: number = 50,
  knowledge_node_id?: number,
  status?: string,
  level?: number,
  question_type?: string,
  has_passage?: boolean,
  creator_id?: number
): Promise<PaginatedResponse<Question>> {
  const params = new URLSearchParams();
  params.append('skip', skip.toString());
  params.append('limit', limit.toString());
  if (knowledge_node_id) params.append('knowledge_node_id', knowledge_node_id.toString());
  if (status) params.append('status', status);
  if (level) params.append('level', level.toString());
  if (question_type) params.append('question_type', question_type);
  if (has_passage !== undefined) params.append('has_passage', has_passage.toString());
  if (creator_id) params.append('creator_id', creator_id.toString());

  const response = await client.get<PaginatedResponse<Question>>(`/api/v1/questions/?${params.toString()}`);
  return response.data;
}

export async function checkDuplicate(content: string, knowledge_node_id: number, threshold: number = 0.8): Promise<import('../types').QuestionSimilarityResponse[]> {
  const response = await client.post<import('../types').QuestionSimilarityResponse[]>(`/api/v1/questions/check-duplicate?threshold=${threshold}`, {
    content,
    knowledge_node_id
  });
  return response.data;
}

export async function getQuestion(id: number): Promise<Question> {
  const response = await client.get<Question>(`/api/v1/questions/${id}`);
  return response.data;
}

export async function createQuestion(data: QuestionCreate): Promise<Question> {
  const response = await client.post<Question>('/api/v1/questions/', data);
  return response.data;
}

export async function updateQuestion(id: number, data: QuestionCreate): Promise<Question> {
  const response = await client.put<Question>(`/api/v1/questions/${id}`, data);
  return response.data;
}

export async function deleteQuestion(id: number): Promise<void> {
  await client.delete(`/api/v1/questions/${id}`);
}

export async function approveQuestion(id: number): Promise<Question> {
  const response = await client.post<Question>(`/api/v1/questions/${id}/approve`);
  return response.data;
}

export async function reviewQuestion(id: number, approve: boolean, reject_reason?: string): Promise<Question> {
  const response = await client.post<Question>(`/api/v1/questions/${id}/review`, {
    approve,
    reject_reason
  });
  return response.data;
}

export async function getQuestionSimilarity(id: number, threshold: number = 0.3, limit: number = 10): Promise<import('../types').QuestionSimilarityResponse[]> {
  const response = await client.get<import('../types').QuestionSimilarityResponse[]>(`/api/v1/questions/${id}/similarity`, {
    params: { threshold, limit }
  });
  return response.data;
}

export async function getQuestionHistory(id: number): Promise<Question[]> {
  const response = await client.get<Question[]>(`/api/v1/questions/${id}/history`);
  return response.data;
}

export async function analyzeQuestion(id: number): Promise<import('../types').AiAnalysisResponse> {
  const response = await client.post<import('../types').AiAnalysisResponse>(`/api/v1/questions/${id}/analyze`);
  return response.data;
}

export async function reviewAiAnalysis(id: number, payload: import('../types').AiReviewRequest): Promise<import('../types').AiAnalysisResponse> {
  const response = await client.post<import('../types').AiAnalysisResponse>(`/api/v1/questions/${id}/ai-analysis/review`, payload);
  return response.data;
}

export interface AiReviewQueueItem {
  id: number;
  source_question_id: number | null;
  question_content: string | null;
  analysis_result: import('../types').AiAnalysisResult | null;
  confidence: number | null;
  ai_model_used: string | null;
  review_status: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
}

export async function getAiReviewQueue(
  reviewStatus: string = 'AI_SUGGESTED',
  skip: number = 0,
  limit: number = 50
): Promise<{ items: AiReviewQueueItem[]; total: number }> {
  const response = await client.get<{ items: AiReviewQueueItem[]; total: number }>(
    '/api/v1/questions/ai-review-queue',
    { params: { review_status: reviewStatus, skip, limit } }
  );
  return response.data;
}

// --- AI Suggest Tags ---
export interface AiSuggestedNode {
  name: string;
  node_id?: number;
  node_type: string;
  confidence: number;
  reasoning?: string;
}

export interface AiSuggestTagsResponse {
  primary_suggestion: AiSuggestedNode;
  secondary_suggestions: AiSuggestedNode[];
  cognitive_level?: number;
  tags: string[];
  ai_model: string;
}

export async function suggestQuestionTags(payload: {
  content: string;
  answers?: string[];
  sub_items?: string[];
}): Promise<AiSuggestTagsResponse> {
  const response = await client.post<AiSuggestTagsResponse>(
    '/api/v1/questions/ai-suggest-tags',
    payload
  );
  return response.data;
}
