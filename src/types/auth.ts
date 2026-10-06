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
  hasActiveConversation?: boolean;
  conversationId?: number | null;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface BlockStatus {
  isBlocked: boolean;
  blockedByUser: boolean;
  userBlockedMe: boolean;
}