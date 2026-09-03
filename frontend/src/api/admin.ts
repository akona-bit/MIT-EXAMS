import client from "./client";

export interface StudentItem {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  sbd: string | null;
  is_active: boolean;
  can_view_answers: boolean;
  avg_score: number | null;
  exam_count: number;
}

export interface PaginatedResponse<T> {
  total: number;
  items: T[];
}

export const getStudents = async (
  params: { skip?: number; limit?: number; search?: string } = {}
): Promise<PaginatedResponse<StudentItem>> => {
  const { skip = 0, limit = 50, search } = params;
  const response = await client.get<PaginatedResponse<StudentItem>>(
    "/api/v1/admin/students",
    { params: { skip, limit, ...(search ? { search } : {}) } }
  );
  return response.data;
};

export const updateStudentAccess = async (
  userId: number,
  can_view_answers: boolean
): Promise<{ id: number; can_view_answers: boolean }> => {
  const response = await client.put<{ id: number; can_view_answers: boolean }>(
    `/api/v1/admin/students/${userId}/access`,
    { can_view_answers }
  );
  return response.data;
};

export interface StaffMember {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  role: string;
}

export const getStaffMembers = async (
  params: { skip?: number; limit?: number; search?: string } = {}
): Promise<PaginatedResponse<StaffMember>> => {
  const { skip = 0, limit = 50, search } = params;
  const response = await client.get<PaginatedResponse<StaffMember>>(
    "/api/v1/admin/staff",
    { params: { skip, limit, ...(search ? { search } : {}) } }
  );
  return response.data;
};

export const createStaffMember = async (data: any): Promise<any> => {
  const response = await client.post("/api/v1/admin/staff", data);
  return response.data;
};
export const updateStaffMember = async (userId: number, data: any): Promise<any> => {
  const response = await client.put(`/api/v1/admin/staff/${userId}`, data);
  return response.data;
};

export const inviteUser = async (data: { emails: string[], role_name: string, full_name?: string }): Promise<any> => {
  const response = await client.post("/api/v1/admin/users/invite", data);
  return response.data;
};

export interface SystemSetting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

export const getSystemSettings = async (): Promise<SystemSetting[]> => {
  const response = await client.get<SystemSetting[]>("/api/v1/admin/settings");
  return response.data;
};

export const updateSystemSetting = async (key: string, value: string, description?: string): Promise<SystemSetting> => {
  const response = await client.put<SystemSetting>(`/api/v1/admin/settings/${key}`, { value, description });
  return response.data;
};
