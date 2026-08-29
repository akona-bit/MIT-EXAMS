import client from './client';
import type { User } from '../types';

export async function getMe(): Promise<User> {
  const response = await client.get<User>('/api/v1/auth/me');
  return response.data;
}
