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
