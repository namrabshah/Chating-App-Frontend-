import api from "@/lib/axios";
import { User } from "@/types/auth";
import { LastMessagePreview } from "@/types/message";

export type LastMessage = LastMessagePreview;

export interface GroupMember {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  isOnline?: boolean;
  lastSeen?: string | null;
  role?: "ADMIN" | "MEMBER";
  joinedAt?: string | null;
}

export interface Conversation {
  id: number;
  type?: "DIRECT" | "GROUP";
  otherUser?: User; // Present if DIRECT
  name?: string | null; // Present if GROUP
  avatar?: string | null; // Present if GROUP
  createdBy?: number | null; // Present if GROUP
  memberCount?: number;
  members?: GroupMember[];
  lastMessage: LastMessage | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConversationResponse {
  success: boolean;
  message: string;
  conversation: {
    id: number;
  };
}

export interface CreateGroupResponse {
  success: boolean;
  message: string;
  conversation: Conversation;
}

export interface GetConversationsResponse {
  success: boolean;
  conversations: Conversation[];
}

export type ConversationDetails = Conversation;

export interface ConversationDetailsResponse {
  success: boolean;
  conversation: ConversationDetails;
}

export interface GenericGroupResponse {
  success: boolean;
  message: string;
  members?: GroupMember[];
  group?: Partial<Conversation>;
}

export const createConversation = async (
  userId: number
): Promise<CreateConversationResponse> => {
  const response = await api.post<CreateConversationResponse>(
    "/conversations",
    { userId }
  );

  return response.data;
};

export const createGroup = async (
  data: FormData | { name: string; memberIds: number[]; avatar?: string }
): Promise<CreateGroupResponse> => {
  const isFormData = data instanceof FormData;
  const response = await api.post<CreateGroupResponse>(
    "/conversations/group",
    data,
    isFormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined
  );

  return response.data;
};

export const updateGroup = async (
  conversationId: number,
  data: FormData | { name?: string; avatar?: string }
): Promise<GenericGroupResponse> => {
  const isFormData = data instanceof FormData;
  const response = await api.patch<GenericGroupResponse>(
    `/conversations/${conversationId}/group`,
    data,
    isFormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined
  );

  return response.data;
};

export const addGroupMembers = async (
  conversationId: number,
  userIds: number[]
): Promise<GenericGroupResponse> => {
  const response = await api.post<GenericGroupResponse>(
    `/conversations/${conversationId}/members`,
    { userIds }
  );

  return response.data;
};

export const removeGroupMember = async (
  conversationId: number,
  userId: number
): Promise<GenericGroupResponse> => {
  const response = await api.delete<GenericGroupResponse>(
    `/conversations/${conversationId}/members/${userId}`
  );

  return response.data;
};

export const leaveGroup = async (
  conversationId: number
): Promise<GenericGroupResponse> => {
  const response = await api.post<GenericGroupResponse>(
    `/conversations/${conversationId}/leave`
  );

  return response.data;
};

export const getMyConversations = async (): Promise<Conversation[]> => {
  const response = await api.get<GetConversationsResponse>(
    "/conversations"
  );

  console.log("CONVERSATIONS API RESPONSE:", response.data);

  return response.data.conversations;
};

export const getConversationDetails = async (
  conversationId: number
): Promise<ConversationDetails> => {
  const response = await api.get<ConversationDetailsResponse>(
    `/conversations/${conversationId}`
  );

  return response.data.conversation;
};

export interface DeleteConversationResponse {
  success: boolean;
  message: string;
}

export const deleteConversation = async (
  conversationId: number
): Promise<DeleteConversationResponse> => {
  const response = await api.delete<DeleteConversationResponse>(
    `/conversations/${conversationId}`
  );

  return response.data;
};