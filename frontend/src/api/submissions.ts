import client from './client';

export interface SubmissionItem {
  id: number;
  exam_id: number;
  exam_name: string;
  participant_id: number;
  user_id: number;
  full_name?: string;
  registration_number?: string;
  gender?: string;
  submit_time?: string;
  score?: number;
  total_score?: number;
  omr_image_url?: string;
}

export interface SubmissionsResponse {
  items: SubmissionItem[];
  total: number;
  page: number;
  size: number;
}

export interface GetSubmissionsParams {
  skip?: number;
  limit?: number;
  exam_id?: number;
  keyword?: string;
  gender?: string;
  date_from?: string;
  date_to?: string;
  min_score?: number;
  max_score?: number;
}

export const getSubmissions = async (params: GetSubmissionsParams = {}): Promise<SubmissionsResponse> => {
  const { data } = await client.get('/api/v1/submissions/', { params });
  return data;
};

export const gradeOmrSubmission = async (submissionId: number): Promise<{ task_id: string; message: string }> => {
  const { data } = await client.post(`/api/v1/omr/grade-submission/${submissionId}`);
  return data.data;
};
