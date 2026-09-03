// ============================================================
// TypeScript interfaces cho MIT EXAMS Frontend
// ============================================================

// --- Auth ---
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role_id: number;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
}

export interface User {
  id: number;
  username: string | null;
  email: string | null;
  full_name?: string | null;
  is_active: boolean;
  role_id: number;
  role: Role;
  created_at: string;
  updated_at: string;
}

// --- Knowledge ---
export interface KnowledgeNode {
  id: number;
  name: string;
  description?: string | null;
  level?: string; // TOPIC | CONCEPT | SKILL | NOTE
  parent_id: number | null;
  path?: string;
  question_count?: number;
  children?: KnowledgeNode[];
}

export interface KnowledgeGraphNode {
  id: string;
  entity_id: number;
  label: string;
  type: string;
  path: string;
  question_count: number;
  description?: string;
  note?: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  link_id?: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

// --- Questions ---
export interface Answer {
  id: number;
  content: string;
  is_correct: boolean;
  position: number;
}

export interface Passage {
  id: number;
  public_code: string;
  content: string;
  source_author?: string | null;
  source_title?: string | null;
  creator_id: number;
  created_at: string;
  updated_at: string;
  question_count?: number;
  questions?: Question[];
}

export interface Question {
  id: number;
  public_code: string;
  content: string;
  level: number; // 1: Nhận biết, 2: Thông hiểu, 3: Vận dụng, 4: Vận dụng cao
  type: string;
  status: string; // DRAFT | PENDING | APPROVED | REJECTED
  reject_reason?: string | null;
  knowledge_node_id: number;
  parent_question_id?: number | null;
  passage_id?: number | null;
  source_author?: string | null;
  source_title?: string | null;
  knowledge_node?: KnowledgeNode;
  passage?: Passage;
  answers: Answer[];
  usage_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface QuestionSimilarityResponse {
  question_id: number;
  similarity_score: number;
  content: string;
  status: string;
}

export interface QuestionCreate {
  content: string;
  level: number;
  type: string;
  knowledge_node_id: number;
  passage_id?: number | null;
  source_author?: string | null;
  source_title?: string | null;
  answers: { content: string; is_correct: boolean; position: number }[];
}

// --- AI Analysis ---
export enum AiReviewStatus {
  PENDING = "PENDING",
  HUMAN_CONFIRMED = "HUMAN_CONFIRMED",
  HUMAN_REJECTED = "HUMAN_REJECTED",
  HUMAN_EDITED = "HUMAN_EDITED",
}

export interface AiAnalysisResult {
  concepts: string[];
  skills: string[];
  cognitive_level: number;
  explanation: string;
}

export interface AiAnalysisCache {
  id: number;
  content_hash: string;
  analysis_result?: AiAnalysisResult;
  review_status: AiReviewStatus;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface AiAnalysisResponse {
  id: number;
  content_hash: string;
  analysis_result?: AiAnalysisResult;
  review_status: AiReviewStatus;
}

export interface AiReviewRequest {
  review_status: AiReviewStatus;
  updated_analysis_result?: AiAnalysisResult;
}

// --- Matrix ---
export interface MatrixRuleGroup {
  id?: number;
  local_id: string;
  label?: string | null;
  required_passage_id?: number | null;
}

export interface MatrixRule {
  id: number;
  knowledge_node_id: number;
  question_type: string;
  level: number;
  count: number;
  part: number;
  knowledge_node?: KnowledgeNode;
  group_id?: number | null;
  group_local_id?: string;
}

export interface Matrix {
  id: number;
  name: string;
  description: string | null;
  subject?: string | null;
  rules: MatrixRule[];
  groups?: MatrixRuleGroup[];
  created_at?: string;
}

// --- Exam ---
export interface Exam {
  id: number;
  name: string;
  description?: string | null;
  matrix_id: number;
  status: string; // DRAFT | PUBLISHED | COMPLETED
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  show_score_mode: string;
  show_answer_mode: string;
  created_at: string;
}

export interface ExamForm {
  id: number;
  exam_id: number;
  code: string;
  is_original: boolean;
}

export interface ExamParticipant {
  id: number;
  exam_id: number;
  user_id: number;
  exam_form_id: number | null;
  status: string; // NOT_STARTED | IN_PROGRESS | SUBMITTED
  start_time: string | null;
  submit_time: string | null;
  is_banned: boolean;
}

// --- Exam Session (Student) ---
export interface ExamSessionInfo {
  exam_id: number;
  exam_name: string;
  form_code: string;
  remaining_seconds: number | null;
  server_time: string;
  participant_status: string;
}

export interface ExamFormQuestion {
  id: number;
  position: number;
  question: {
    id: number;
    content: string;
  };
  answers: {
    id: number;
    content: string;
    position: number;
  }[];
}

// --- Statistics ---
export interface ExamOverview {
  total_participants: number;
  total_submitted: number;
  avg_score: number;
  score_distribution: { range: string; count: number }[];
}

export interface ItemAnalysis {
  question_id: number;
  position: number;
  difficulty: number;
  discrimination: number;
  flags: string[];
}

// --- Grading ---
export interface ExamResult {
  id: number;
  exam_participant_id: number;
  raw_score: number;
  section_scores: Record<string, number>;
  total_correct: number;
  total_questions: number;
}

// --- Pagination ---
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
