import client from './client';
import type { Question, QuestionCreate, PaginatedResponse } from '../types';

export async function getQuestions(
  skip: number = 0,
  limit: number = 50,
  knowledge_node_id?: number,
  status?: string,
  level?: number
): Promise<PaginatedResponse<Question>> {
  const params = new URLSearchParams();
  params.append('skip', skip.toString());
  params.append('limit', limit.toString());
  if (knowledge_node_id) params.append('knowledge_node_id', knowledge_node_id.toString());
  if (status) params.append('status', status);
  if (level) params.append('level', level.toString());

  const response = await client.get<PaginatedResponse<Question>>(`/api/v1/questions/?${params.toString()}`);
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
