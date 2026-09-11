import client from "./client";

// ─── Types ────────────────────────────────────────────────────────────

export interface VActProgressEntry {
  date: string | null;
  total_score: number | null;
  tieng_viet: number | null;
  tieng_anh: number | null;
  toan_hoc: number | null;
  tu_duy_khoa_hoc: number | null;
  has_irt_score: boolean;
  raw_total_score: number;
}

export interface VActProgressResponse {
  series: VActProgressEntry[];
  current: Record<string, number | null>;
  deltas: Record<string, number>;
  total_submissions: number;
  irt_submissions: number;
  first_date: string | null;
}

export interface SubjectScores {
  tieng_viet: number | null;
  tieng_anh: number | null;
  toan_hoc: number | null;
  tu_duy_khoa_hoc: number | null;
  total: number | null;
}

export interface VActRadarResponse {
  latest: SubjectScores | null;
  previous: SubjectScores | null;
  deltas: Record<string, number>;
  subject_labels: Record<string, string>;
}

export interface ActivityDay {
  date: string;
  submissions: number;
  lessons: number;
  forum: number;
  watch_minutes: number;
  is_strengthened: boolean;
  total_activity: number;
}

export interface ActivityHeatmapResponse {
  days: ActivityDay[];
  summary: {
    active_days: number;
    total_days: number;
    strengthened_days: number;
    total_watch_minutes: number;
  };
}

export interface KnowledgeMasteryItem {
  id: number;
  knowledge_node_id: number;
  topic_name: string;
  topic_subject: string | null;
  status: string;
  correct_count: number;
  wrong_count: number;
  blank_count: number;
  total_attempts: number;
  accuracy_pct: number;
  last_wrong: {
    question_id: number;
    exam_label: string;
    question_number: number;
  } | null;
}

export interface KnowledgeNetworkResponse {
  summary: {
    total: number;
    overdue_review: number;
    upcoming_review: number;
    on_track: number;
  };
  items: KnowledgeMasteryItem[];
  has_more: boolean;
}

// ─── API Calls ────────────────────────────────────────────────────────

export const getVActProgress = async (studentId: number): Promise<VActProgressResponse> => {
  const { data } = await client.get(`/api/v1/students/${studentId}/vact-progress`);
  return data;
};

export const getVActRadar = async (studentId: number): Promise<VActRadarResponse> => {
  const { data } = await client.get(`/api/v1/students/${studentId}/vact-radar`);
  return data;
};

export const getActivityHeatmap = async (
  studentId: number,
  weeks = 8
): Promise<ActivityHeatmapResponse> => {
  const { data } = await client.get(`/api/v1/students/${studentId}/activity-heatmap`, {
    params: { weeks },
  });
  return data;
};

export const getKnowledgeNetwork = async (
  studentId: number
) => {
  const { data } = await client.get(`/api/v1/students/${studentId}/knowledge-network`);
  return data;
};

export const getKnowledgeNodeDetail = async (
  studentId: number,
  nodeId: number
) => {
  const { data } = await client.get(`/api/v1/students/${studentId}/knowledge-network/${nodeId}/detail`);
  return data;
};

export const getProfileSummary = async (
  studentId: number
) => {
  const { data } = await client.get(`/api/v1/students/${studentId}/profile-summary`);
  return data;
};
