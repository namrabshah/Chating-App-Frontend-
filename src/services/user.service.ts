import api from "@/lib/axios";
import type { User } from "@/types/auth";

interface SearchUsersResponse {
  success: boolean;
  users: User[];
}

interface MyProfileResponse {
  success: boolean;
  user: User;
}

export interface UpdateProfilePayload {
  name?: string;
  avatarFile?: File | null;
}

interface UpdateProfileResponse {
  success: boolean;
  message: string;
  user: User;
}

export const getMyProfile = async (): Promise<User> => {
  const response = await api.get<MyProfileResponse>("/users/me");

  return response.data.user;
};

export const updateMyProfile = async (
  payload: UpdateProfilePayload
): Promise<User> => {
  const formData = new FormData();
  if (payload.name !== undefined) {
    formData.append("name", payload.name);
  }
  if (payload.avatarFile) {
    formData.append("avatar", payload.avatarFile);
  }

  const response = await api.patch<UpdateProfileResponse>("/users/me", formData);

  return response.data.user;
};

export const searchUsers = async (
  query: string
): Promise<User[]> => {
  const response = await api.get<SearchUsersResponse>("/users/search", {
    params: {
      q: query,
    },
  });

  return response.data.users;
};
