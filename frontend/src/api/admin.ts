import client from "./client";

export interface UserAccess {
  id: number;
  email: string;
  username: string;
  can_view_answers: boolean;
}

export const getUsers = async (): Promise<UserAccess[]> => {
  const response = await client.get<UserAccess[]>("/api/v1/admin/users");
  return response.data;
};

export const updateUserAccess = async (userId: number, can_view_answers: boolean): Promise<{id: number, can_view_answers: boolean}> => {
  const response = await client.put<{id: number, can_view_answers: boolean}>(`/api/v1/admin/users/${userId}/access`, {
    can_view_answers
  });
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

export const getStaffMembers = async (): Promise<StaffMember[]> => {
  const response = await client.get<StaffMember[]>("/api/v1/admin/staff");
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
