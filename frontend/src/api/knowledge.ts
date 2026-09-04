import client from "./client";
import type { KnowledgeGraph, KnowledgeNode } from "../types";

export async function getKnowledgeNodes(
  _skip: number = 0,
  _limit: number = 100,
  level?: string,
  parent_id?: number,
): Promise<KnowledgeNode[]> {
  const params = new URLSearchParams();
  if (level) params.append("level", level);
  if (parent_id !== undefined) params.append("parent_id", parent_id.toString());

  const response = await client.get<KnowledgeNode[]>(
    `/api/v1/knowledge/?${params.toString()}`,
  );
  return response.data;
}

export async function getKnowledgeTree(subject?: string): Promise<KnowledgeNode[]> {
  const params = new URLSearchParams();
  if (subject) params.append("subject", subject);
  
  const response = await client.get<KnowledgeNode[]>(`/api/v1/knowledge/tree${subject ? `?${params.toString()}` : ''}`);
  return response.data;
}

export async function getKnowledgeNodeContext(id: number): Promise<any> {
  const response = await client.get<any>(`/api/v1/knowledge/${id}/context`);
  return response.data;
}

export async function getKnowledgeGraph(subject?: string): Promise<KnowledgeGraph> {
  const params = new URLSearchParams();
  if (subject) params.append("subject", subject);
  const response = await client.get<KnowledgeGraph>(`/api/v1/knowledge/graph${subject ? `?${params.toString()}` : ''}`);
  return response.data;
}

export async function createKnowledgeNode(data: {
  name: string;
  description?: string;
  parent_id?: number;
  node_type?: string;
  subject?: string;
  short_code?: string;
}): Promise<KnowledgeNode> {
  const response = await client.post<KnowledgeNode>("/api/v1/knowledge/", data);
  return response.data;
}

export async function updateKnowledgeNode(
  id: number,
  data: {
    name?: string;
    description?: string;
    note?: string | null;
    parent_id?: number | null;
    node_type?: string;
    subject?: string;
    short_code?: string;
  }
): Promise<KnowledgeNode> {
  const response = await client.patch<KnowledgeNode>(`/api/v1/knowledge/${id}`, data);
  return response.data;
}

export async function deleteKnowledgeNode(id: number): Promise<void> {
  await client.delete(`/api/v1/knowledge/${id}`);
}

export async function createManualLink(data: {
  source_id: number;
  target_id: number;
  label?: string;
}): Promise<{ id: number; source_id: number; target_id: number; label?: string }> {
  const response = await client.post("/api/v1/knowledge/links", data);
  return response.data;
}

export async function deleteManualLink(linkId: number): Promise<void> {
  await client.delete(`/api/v1/knowledge/links/${linkId}`);
}
