import client from './client';

export interface AnswerAccessGrant {
  id: number;
  student_id: number;
  exam_id: number | null;
  granted: boolean;
  source: string;
  granted_by: number | null;
  payment_ref: string | null;
  granted_at: string;
  expires_at: string | null;
  note: string | null;
}

export const adminAccessApi = {
  listAnswerAccess: async (studentId?: number): Promise<{items: AnswerAccessGrant[]}> => {
    const params = studentId ? { student_id: studentId } : {};
    const { data } = await client.get('/api/v1/admin/answer-access', { params });
    return data;
  },

  createAnswerAccess: async (payload: { student_id: number, exam_id?: number | null, source?: string, note?: string | null, expires_at?: string | null }) => {
    const { data } = await client.post('/api/v1/admin/answer-access', payload);
    return data;
  },

  updateAnswerAccess: async (id: number, payload: { granted?: boolean, expires_at?: string | null, note?: string | null }) => {
    const { data } = await client.patch(`/api/v1/admin/answer-access/${id}`, payload);
    return data;
  }
};
