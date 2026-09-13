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
  average_score: number | null;
  max_score: number | null;
  min_score: number | null;
  distribution: { range: string; count: number }[];
  /** false = chưa có bài làm nào được chấm điểm cho kỳ thi này */
  has_data: boolean;
}

export interface ExamItemAnalysis {
  question_id: number;
  content: string | null;
  /** IRT b-param được calibrate trong kỳ thi này (null nếu chưa chạy IRT) */
  difficulty_b: number | null;
  /** IRT a-param được calibrate trong kỳ thi này */
  discrimination_a: number | null;
  /** CTT: tỷ lệ trả lời đúng (0-1) */
  ctt_difficulty: number | null;
  /** CTT: D-Index độ phân biệt */
  ctt_discrimination: number | null;
  /** p-value của kiểm định Chi² độ khớp model IRT */
  chi_square_p: number | null;
  computed_at: string | null;
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
