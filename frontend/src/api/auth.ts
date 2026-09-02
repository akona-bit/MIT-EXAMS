import client from './client';
import type { User } from '../types';

export async function getMe(): Promise<User> {
  const response = await client.get<User>('/api/v1/auth/me');
  return response.data;
}

export async function resolveSBD(sbd: string): Promise<{ email: string }> {
  const response = await client.post<{ email: string }>('/api/v1/auth/resolve-sbd', { sbd });
  return response.data;
}

export async function updateMe(full_name: string): Promise<User> {
  const response = await client.put<User>('/api/v1/auth/me', { full_name });
  return response.data;
}
