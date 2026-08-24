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

export async function getKnowledgeTree(): Promise<KnowledgeNode[]> {
  const response = await client.get<KnowledgeNode[]>("/api/v1/knowledge/tree");
  return response.data;
}

export async function getKnowledgeGraph(): Promise<KnowledgeGraph> {
  const response = await client.get<KnowledgeGraph>("/api/v1/knowledge/graph");
  return response.data;
}

export async function createKnowledgeNode(data: {
  name: string;
  description?: string;
  parent_id?: number;
}): Promise<KnowledgeNode> {
  const response = await client.post<KnowledgeNode>("/api/v1/knowledge/", data);
  return response.data;
}
