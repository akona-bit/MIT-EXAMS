import client from "./client";

export interface DashboardOverview {
  total_questions: number;
  total_exams: number;
  total_participants: number;
  total_submissions: number;
  recent_exams: {
    id: number;
    name: string;
    start_time: string | null;
    end_time: string | null;
    status: string;
  }[];
  score_distribution: { range: string; count: number }[];
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const response = await client.get<DashboardOverview>(
    "/api/v1/statistics/overview",
  );
  return response.data;
}

export interface ExamOverview {
  total_participants: number;
  average_score: number;
  max_score: number;
  min_score: number;
  distribution: { range: string; count: number }[];
}

export interface ExamItemAnalysis {
  question_id: number;
  content: string;
  difficulty_b: number;
  discrimination_a: number;
  guessing_c: number;
  is_calibrated: boolean;
  warning_flags: string[];
}

export async function getExamOverview(examId: number): Promise<ExamOverview> {
  const response = await client.get<ExamOverview>(
    `/api/v1/statistics/exams/${examId}/overview`
  );
  return response.data;
}

export async function getExamItemsAnalysis(examId: number): Promise<ExamItemAnalysis[]> {
  const response = await client.get<ExamItemAnalysis[]>(
    `/api/v1/statistics/exams/${examId}/items`
  );
  return response.data;
}
