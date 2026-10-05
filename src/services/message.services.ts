import api from "@/lib/axios";
import { Message, ReplyToMessagePreview } from "@/types/message";

export type { Message, ReplyToMessagePreview };

export interface GetMessagesResponse {
  success: boolean;
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
  messages: Message[];
}

export interface SendMessageResponse {
  success: boolean;
  message: Message;
}

export const getMessages = async (
  conversationId: number,
  page: number = 1,
  limit: number = 20
): Promise<GetMessagesResponse> => {
  const response = await api.get<GetMessagesResponse>(
    `/messages/${conversationId}`,
    {
      params: {
        page,
        limit,
      },
    }
  );

  return response.data;
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

export const deleteMessage = async (
  messageId: number,
  deleteType: "me" | "everyone"
): Promise<{
  success: boolean;
  deleteType: "me" | "everyone";
  messageId?: number;
  message?: Message;
}> => {
  const response = await api.delete<{
    success: boolean;
    deleteType: "me" | "everyone";
    messageId?: number;
    message?: Message;
  }>(`/messages/${messageId}`, {
    data: { deleteType },
  });

  return response.data;
};

export interface ToggleReactionResponse {
  success: boolean;
  action: "added" | "updated" | "removed";
  messageId: number;
  reaction: string | null;
  reactions: Message["reactions"];
  myReaction?: string | null;
}

export const toggleMessageReaction = async (
  messageId: number,
  reaction: string
): Promise<ToggleReactionResponse> => {
  const response = await api.put<ToggleReactionResponse>(
    `/messages/${messageId}/reaction`,
    { reaction }
  );

  return response.data;
};


export const searchMessages = async (
  conversationId: number,
  query: string
): Promise<Message[]> => {
  const response = await api.get<GetMessagesResponse>(
    `/messages/${conversationId}/search`,
    {
      params: {
        q: query,
      },
    }
  );

  return response.data.messages;
};