import client from "./client";

export interface SyncDetails {
  file: string;
  status: "success" | "skipped" | "error";
  reason?: string;
  question_id?: number;
  wikilinks?: string[];
}

export interface SyncResponse {
  success: number;
  skipped: number;
  error: number;
  sync_run_id?: number;
  details: SyncDetails[];
}

export interface SyncRun {
  id: number;
  api_url: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  success_count: number;
  skipped_count: number;
  error_count: number;
  started_at: string;
  finished_at?: string | null;
}

export interface SyncRequest {
  api_url: string;
  api_key: string;
}

export async function syncObsidianLocalApi(
  data: SyncRequest,
): Promise<SyncResponse> {
  const response = await client.post<SyncResponse>(
    "/api/v1/obsidian/sync-local-api",
    data,
  );
  return response.data;
}

export async function getObsidianSyncHistory(limit = 20): Promise<SyncRun[]> {
  const response = await client.get<SyncRun[]>(
    `/api/v1/obsidian/history?limit=${limit}`,
  );
  return response.data;
}
