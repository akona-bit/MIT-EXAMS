import client from './client';
import type { Token, User, LoginRequest, RegisterRequest } from '../types';

export async function login(data: LoginRequest): Promise<Token> {
  // Backend uses OAuth2PasswordRequestForm (form-encoded, not JSON)
  const formData = new URLSearchParams();
  formData.append('username', data.username);
  formData.append('password', data.password);

  const response = await client.post<Token>('/api/v1/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data;
}

export async function register(data: RegisterRequest): Promise<User> {
  const response = await client.post<User>('/api/v1/auth/register', data);
  return response.data;
}

export async function getMe(): Promise<User> {
  const response = await client.get<User>('/api/v1/auth/me');
  return response.data;
}
