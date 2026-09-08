export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  isOnline?: boolean;
  lastSeen?: string | null;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}