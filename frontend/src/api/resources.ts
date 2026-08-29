import client from "./client";

export type ResourceType = "IMAGE" | "PDF" | "TEXT";

export interface Resource {
  id: number;
  type: ResourceType;
  content_url: string;
  uploader_id: number;
  original_name: string;
  mime_type?: string | null;
  size_bytes: number;
  created_at: string;
}

export async function getResources(): Promise<Resource[]> {
  const response = await client.get<Resource[]>("/api/v1/resources/");
  return response.data;
}

export async function uploadResource(file: File): Promise<Resource> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await client.post<Resource>(
    "/api/v1/resources/upload",
    formData
  );
  return response.data;
}

export async function deleteResource(id: number): Promise<void> {
  await client.delete(`/api/v1/resources/${id}`);
}
