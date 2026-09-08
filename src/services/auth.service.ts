import api from "@/lib/axios";
import {
  RegisterPayload,
  LoginPayload,
  AuthResponse,
} from "@/types/auth";

export const registerUser = async (
  data: RegisterPayload
): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>(
    "/auth/register",
    data
  );

  return response.data;
};

export const loginUser = async (
  data: LoginPayload
): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>(
    "/auth/login",
    data
  );

  return response.data;
};