import api from "@/lib/axios";

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  isDelivered: boolean;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface GetMessagesResponse {
  success: boolean;
  page?: number;
  limit?: number;
  messages: Message[];
}

export interface SendMessageResponse {
  success: boolean;
  message: Message;
}

export const getMessages = async (
  conversationId: number
): Promise<Message[]> => {
  const response = await api.get<GetMessagesResponse>(
    `/messages/${conversationId}`
  );

  return response.data.messages;
};

export const sendMessage = async (
  conversationId: number,
  content: string
): Promise<SendMessageResponse> => {
  const response = await api.post<SendMessageResponse>(
    `/messages/${conversationId}`,
    { content }
  );

  return response.data;
};