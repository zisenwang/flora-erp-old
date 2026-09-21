import client from "./client.ts";

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: { id: number; username: string; name: string; role: string; permissions: string[] };
}

export interface UserRow {
  id: number;
  username: string;
  name: string;
  role: string;
  status: number;
  permissions: string[];
}

export const login = async (payload: LoginPayload): Promise<LoginResponse> => {
  const res = await client.post<{ data: LoginResponse }>("/auth/login", payload);
  return res.data.data;
};

export const listUsers = async (): Promise<UserRow[]> => {
  const res = await client.get<{ data: UserRow[] }>("/auth/users");
  return res.data.data;
};

export const createUser = async (data: {
  username: string; name: string; password: string; role: string;
}): Promise<UserRow> => {
  const res = await client.post<{ data: UserRow }>("/auth/users", data);
  return res.data.data;
};

export const updateUser = async (id: number, data: {
  username: string; name: string; role: string; status: number;
}): Promise<UserRow> => {
  const res = await client.put<{ data: UserRow }>(`/auth/users/${id}`, data);
  return res.data.data;
};

export const changePassword = async (id: number, data: {
  oldPassword?: string; newPassword: string;
}): Promise<void> => {
  await client.put(`/auth/users/${id}/password`, data);
};

export const getUserPermissions = async (id: number): Promise<string[]> => {
  const res = await client.get<{ data: string[] }>(`/auth/users/${id}/permissions`);
  return res.data.data;
};

export const setUserPermissions = async (id: number, permissions: string[]): Promise<void> => {
  await client.put(`/auth/users/${id}/permissions`, { permissions });
};
