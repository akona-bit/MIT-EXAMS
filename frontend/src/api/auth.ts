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

export async function sendOtp(email: string): Promise<{ message: string }> {
  const response = await client.post<{ message: string }>('/api/v1/auth/send-otp', { email });
  return response.data;
}

export async function verifyOtp(email: string, code: string): Promise<{ access_token: string; token_type: string }> {
  const response = await client.post<{ access_token: string; token_type: string }>('/api/v1/auth/verify-otp', { email, code });
  return response.data;
}

export async function sendResetPassword(email: string): Promise<{ message: string }> {
  const response = await client.post<{ message: string }>('/api/v1/auth/send-reset-password', { email });
  return response.data;
}

export async function resetPassword(email: string, code: string, new_password: string): Promise<{ message: string }> {
  const response = await client.post<{ message: string }>('/api/v1/auth/reset-password', { email, code, new_password });
  return response.data;
}
