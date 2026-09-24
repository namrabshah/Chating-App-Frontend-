export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string | null;
  isDelivered: boolean;
  isRead: boolean;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  attachmentSize?: number | null;
  createdAt: string;
  updatedAt?: string;
}

export interface LastMessagePreview {
  id: number;
  content: string | null;
  senderId: number;
  createdAt: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  attachmentSize?: number | null;
}
