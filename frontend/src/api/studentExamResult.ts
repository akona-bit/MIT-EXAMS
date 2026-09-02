import client from './client';

// --- Types cho trang kết quả thí sinh ---
export interface RawScorePart {
  part: number;
  label: string;
  raw_score: number;
  max_raw_score: number;
  irt_score: number | null;
}

export interface RawScores {
  parts: RawScorePart[];
  total: number;
  max_total: number;
  answered_count: number;
  total_questions: number;
  method: string;
}

export interface TrueScore {
  state: 'done' | 'computing' | 'failed' | 'not_enough_data' | 'no_data';
  eligible: boolean;
  message: string;
  available: boolean;
  irt_total: number | null;
}

export interface ReviewOption {
  answer_id: number;
  label: string;
  content: string | null;
  is_correct: boolean;
}

export interface ReviewQuestion {
  position: number;
  part: number;
  part_label: string;
  question_id: number;
  content: string | null;
  question_type: string | null;
  options: ReviewOption[];
  selected_answer_ids: number[];
  selected_subitem_answers: Record<string, number> | null;
  text_answer: string | null;
  score: number | null;
  max_points: number | null;
  status: 'correct' | 'wrong' | 'skipped' | 'penalized';
}

export interface StudentExamResult {
  exam_id: number;
  exam_name: string | null;
  submission_id: number;
  submit_time: string | null;
  participant_status: 'SUBMITTED' | 'SUSPENDED';
  is_suspended: boolean;
  raw_scores: RawScores;
  true_score: TrueScore;
  can_view_answers: boolean;
  review: ReviewQuestion[] | null;
}

export async function getStudentExamResult(examId: number): Promise<StudentExamResult> {
  const response = await client.get<StudentExamResult>(`/api/v1/exams/${examId}/result`);
  return response.data;
}
