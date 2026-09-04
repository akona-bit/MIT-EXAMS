import apiClient from './client';

export type ResourceType = 'TEXT' | 'IMAGE' | 'PDF' | 'HANDWRITING' | 'CHART';

export interface ResourceResponse {
  id: string;
  type: ResourceType;
  content_url: string;
  original_name: string;
  mime_type?: string;
  size_bytes: number;
  created_at: string;
  bucket?: string;
}

// Map tab → ResourceType
export const TAB_TYPE_MAP: Record<string, ResourceType> = {
  'van-ban': 'TEXT',
  'anh': 'IMAGE',
  'pdf': 'PDF',
  'viet-tay': 'HANDWRITING',
  'bang': 'CHART',
};

export const resourceApi = {
  /**
   * List resources từ Supabase storage.
   * Nếu type = undefined → list tất cả buckets.
   */
  list: async (type?: ResourceType): Promise<ResourceResponse[]> => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    const { data } = await apiClient.get(`/api/v1/resources/?${params.toString()}`);
    return data;
  },

  /**
   * Upload file vào đúng bucket theo type.
   */
  upload: async (file: File, type?: ResourceType): Promise<ResourceResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (type) formData.append('type', type);
    const { data } = await apiClient.post('/api/v1/resources/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: type ? { type } : undefined,
    });
    return data;
  },

  /**
   * Delete resource. id format: "bucket/file_name"
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/resources/${encodeURIComponent(id)}`);
  },
};
