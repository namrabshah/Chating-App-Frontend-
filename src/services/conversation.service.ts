import api from "@/lib/axios";
import { User } from "@/types/auth";
import { LastMessagePreview } from "@/types/message";

export type LastMessage = LastMessagePreview;

export interface Conversation {
  id: number;
  otherUser: User;
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

export interface GetConversationsResponse {
  success: boolean;
  conversations: Conversation[];
}

export interface ConversationDetails extends Conversation {}

export interface ConversationDetailsResponse {
  success: boolean;
  conversation: ConversationDetails;
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