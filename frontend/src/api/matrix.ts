import client from './client';
import type { Matrix, PaginatedResponse } from '../types';

export async function getMatrices(skip: number = 0, limit: number = 50): Promise<PaginatedResponse<Matrix>> {
  const response = await client.get<PaginatedResponse<Matrix>>(`/api/v1/matrix/?skip=${skip}&limit=${limit}`);
  return response.data;
}

export async function getMatrix(id: number): Promise<Matrix> {
  const response = await client.get<Matrix>(`/api/v1/matrix/${id}`);
  return response.data;
}

export async function createMatrix(data: any): Promise<Matrix> {
  const response = await client.post<Matrix>('/api/v1/matrix/', data);
  return response.data;
}

export async function updateMatrix(id: number, data: any): Promise<Matrix> {
  const response = await client.put<Matrix>(`/api/v1/matrix/${id}`, data);
  return response.data;
}

export async function deleteMatrix(id: number): Promise<void> {
  await client.delete(`/api/v1/matrix/${id}`);
}

export async function checkMatrixFeasibility(matrixId: number): Promise<{ feasible: boolean; message?: string; shortages?: string[] }> {
  const response = await client.post(`/api/v1/matrix/${matrixId}/check-feasibility`);
  return response.data;
}

export async function previewMatrixImport(matrixId: number, data: { content: string; level_ratios: Record<number, number>; type_ratios: Record<string, number> }): Promise<{ preview: any[] }> {
  const response = await client.post(`/api/v1/matrix/${matrixId}/import/preview`, data);
  return response.data;
}

export async function executeMatrixImport(matrixId: number, data: { confirmed_rows: any[]; strategy: string }): Promise<{ message: string; total_questions_added: number }> {
  const response = await client.post(`/api/v1/matrix/${matrixId}/import/execute`, data);
  return response.data;
}

export async function getSmartLeaves(nodeIds: number[]): Promise<{ leaves: any[]; total_questions_in_bank: number }> {
  const response = await client.post('/api/v1/matrix/smart/leaves', { node_ids: nodeIds });
  return response.data;
}

export async function proposeSmartDistribution(data: { node_ids: number[]; total_questions: number; level_ratios?: Record<number, number>; type_ratios?: Record<string, number> }): Promise<{ skills: any[]; total_proposed: number; total_in_bank: number }> {
  const response = await client.post('/api/v1/matrix/smart/propose', data);
  return response.data;
}

export async function confirmSmartMatrix(data: any): Promise<Matrix> {
  const response = await client.post('/api/v1/matrix/smart/confirm', data);
  return response.data;
}

export async function getMatrixUsage(matrixId: number): Promise<{ matrix_id: number; total_runs: number; successful_runs: number; is_used: boolean }> {
  const response = await client.get(`/api/v1/matrix/${matrixId}/usage`);
  return response.data;
}

export async function createMatrixVersion(matrixId: number): Promise<Matrix> {
  const response = await client.post(`/api/v1/matrix/${matrixId}/create-version`);
  return response.data;
}
