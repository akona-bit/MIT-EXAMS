import client from "./client";
import type { Exam, PaginatedResponse, ExamForm } from "../types";

export interface GenerateExamRequest {
  exam_id: number;
  number_of_forms: number;
  distinct_questions: boolean;
}

export async function getExams(
  skip: number = 0,
  limit: number = 50,
  status?: string,
): Promise<PaginatedResponse<Exam>> {
  const params = new URLSearchParams();
  params.append("skip", skip.toString());
  params.append("limit", limit.toString());
  if (status) params.append("status", status);

  const response = await client.get<PaginatedResponse<Exam>>(
    `/api/v1/exams/?${params.toString()}`,
  );
  return response.data;
}

export async function getExam(id: number): Promise<Exam> {
  const response = await client.get<Exam>(`/api/v1/exams/${id}`);
  return response.data;
}

export async function getExamForms(id: number): Promise<ExamForm[]> {
  const response = await client.get<ExamForm[]>(`/api/v1/exams/${id}/forms`);
  return response.data;
}

export async function createExam(data: any): Promise<Exam> {
  const response = await client.post<Exam>("/api/v1/exams/", data);
  return response.data;
}

// LEGACY:
export async function generateExam(data: any): Promise<Exam> {
  const response = await client.post<Exam>("/api/v1/exams/generate", data);
  return response.data;
}

export async function generateExamFromMatrix(
  matrixId: number,
  data: GenerateExamRequest
): Promise<any> {
  const response = await client.post(`/api/v1/matrix/${matrixId}/generate`, data);
  return response.data;
}

export async function generateExamForms(
  id: number,
  formCount: number,
): Promise<ExamForm[]> {
  const response = await client.post<ExamForm[]>(
    `/api/v1/exams/${id}/generate?form_count=${formCount}`,
  );
  return response.data;
}

export async function publishExam(id: number): Promise<Exam> {
  const response = await client.post<Exam>(`/api/v1/exams/${id}/publish`);
  return response.data;
}

export async function assignParticipants(
  id: number,
  userIds: number[],
): Promise<any> {
  const response = await client.post(`/api/v1/exams/${id}/assign`, userIds);
  return response.data;
}
