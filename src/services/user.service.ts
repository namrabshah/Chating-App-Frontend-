import api from "@/lib/axios";
import type { User, BlockStatus } from "@/types/auth";

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

interface BlockUserResponse {
  success: boolean;
  message: string;
}

interface BlockStatusResponse {
  success: boolean;
  isBlocked: boolean;
  blockedByUser: boolean;
  userBlockedMe: boolean;
}

interface BlockedUsersResponse {
  success: boolean;
  users: User[];
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

export const blockUser = async (
  userId: number
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post<BlockUserResponse>(`/users/${userId}/block`);
  return response.data;
};

export const unblockUser = async (
  userId: number
): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete<BlockUserResponse>(`/users/${userId}/block`);
  return response.data;
};

export const getBlockStatus = async (
  userId: number
): Promise<BlockStatus> => {
  const response = await api.get<BlockStatusResponse>(`/users/${userId}/block-status`);
  return {
    isBlocked: response.data.isBlocked,
    blockedByUser: response.data.blockedByUser,
    userBlockedMe: response.data.userBlockedMe,
  };
};

export const getBlockedUsers = async (): Promise<User[]> => {
  const response = await api.get<BlockedUsersResponse>("/users/blocked");
  return response.data.users;
};
