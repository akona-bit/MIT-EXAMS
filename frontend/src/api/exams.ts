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

export async function updateExam(id: number, data: Partial<Exam>): Promise<Exam> {
  const response = await client.put<Exam>(`/api/v1/exams/${id}`, data);
  return response.data;
}

export async function deleteExam(id: number): Promise<void> {
  await client.delete(`/api/v1/exams/${id}`);
}

export async function completeExam(id: number): Promise<Exam> {
  const response = await client.post<Exam>(`/api/v1/exams/${id}/complete`);
  return response.data;
}

export async function assignParticipants(
  id: number,
  userIds: number[],
): Promise<any> {
  const response = await client.post(`/api/v1/exams/${id}/assign`, userIds);
  return response.data;
}

export function exportExamLaTeX(examId: number, formCode?: string) {
  let url = `/api/v1/exams/${examId}/export/latex`;
  if (formCode) {
    url += `?form_code=${formCode}`;
  }
  // Extract token to add to URL if needed, or assume cookie-based/URL-based auth
  // But wait, it's a GET request, so window.open doesn't send Authorization header
  // Let's use fetch and trigger download
  
  return client.get(url, { responseType: 'blob' }).then(response => {
    const blob = new Blob([response.data], { type: 'text/plain' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    
    // Attempt to extract filename from Content-Disposition
    const disposition = response.headers['content-disposition'];
    let filename = `Exam_${examId}.zip`;
    if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="([^"]*)"/.exec(disposition);
        if (matches != null && matches[1]) filename = matches[1];
    }
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  });
}
