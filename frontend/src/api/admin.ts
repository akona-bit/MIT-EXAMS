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
