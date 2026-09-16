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

export const getMyProfile = async (): Promise<User> => {
  const response = await api.get<MyProfileResponse>("/users/me");

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
