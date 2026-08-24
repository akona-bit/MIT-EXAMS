import client from './client';

export interface SyncDetails {
  file: string;
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  question_id?: number;
}

export interface SyncResponse {
  success: number;
  skipped: number;
  error: number;
  details: SyncDetails[];
}

export interface SyncRequest {
  api_url: string;
  api_key: string;
}

export async function syncObsidianLocalApi(data: SyncRequest): Promise<SyncResponse> {
  const response = await client.post<SyncResponse>('/api/v1/obsidian/sync-local-api', data);
  return response.data;
}
