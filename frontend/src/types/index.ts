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
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
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

export interface Question {
  id: number;
  content: string;
  level: number; // 1: Nhận biết, 2: Thông hiểu, 3: Vận dụng, 4: Vận dụng cao
  type: string;
  status: string; // DRAFT | APPROVED | REJECTED
  knowledge_node_id: number;
  parent_question_id?: number | null;
  knowledge_node?: KnowledgeNode;
  answers: Answer[];
  created_at: string;
  updated_at?: string;
}

export interface QuestionCreate {
  content: string;
  level: number;
  type: string;
  knowledge_node_id: number;
  answers: { content: string; is_correct: boolean; position: number }[];
}

// --- Matrix ---
export interface MatrixRule {
  id: number;
  knowledge_node_id: number;
  question_type: string;
  level: number;
  count: number;
  part: number;
  knowledge_node?: KnowledgeNode;
}

export interface Matrix {
  id: number;
  name: string;
  description: string | null;
  rules: MatrixRule[];
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
  duration_minutes: number;
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
  remaining_seconds: number;
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
