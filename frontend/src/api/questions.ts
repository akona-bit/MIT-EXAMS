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
