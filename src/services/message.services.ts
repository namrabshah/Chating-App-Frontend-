import api from "@/lib/axios";
import { Message, ReplyToMessagePreview } from "@/types/message";

export type { Message, ReplyToMessagePreview };

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
  content?: string,
  file?: File | null,
  replyToMessageId?: number | null
): Promise<SendMessageResponse> => {
  const formData = new FormData();

  if (content?.trim()) {
    formData.append("content", content.trim());
  }

  if (file) {
    formData.append("file", file);
  }

  if (replyToMessageId) {
    formData.append("replyToMessageId", String(replyToMessageId));
  }

  console.log(
    "MESSAGE SERVICE POST:",
    `/messages/${conversationId}`
  );

  const response = await api.post<SendMessageResponse>(
    `/messages/${conversationId}`,
    formData
  );

  console.log(
    "MESSAGE SERVICE RESPONSE:",
    response.data
  );

  return response.data;
};

export const markConversationAsRead = async (
  conversationId: number
): Promise<{ success: boolean; updatedCount?: number }> => {
  const response = await api.patch<{ success: boolean; updatedCount?: number }>(
    `/messages/${conversationId}/read`
  );

  return response.data;
};

export const markMessageAsRead = async (
  messageId: number
): Promise<{ success: boolean; message?: string; data?: unknown }> => {
  const response = await api.patch<{
    success: boolean;
    message?: string;
    data?: unknown;
  }>(`/messages/${messageId}/read`);

  return response.data;
};

export const editMessage = async (
  messageId: number,
  content: string
): Promise<SendMessageResponse> => {
  const response = await api.patch<SendMessageResponse>(
    `/messages/${messageId}`,
    { content }
  );

  return response.data;
};
