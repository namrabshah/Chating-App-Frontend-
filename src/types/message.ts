export interface ReplyToMessagePreview {
  id: number;
  senderId: number;
  senderName?: string | null;
  content?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
}

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
  replyToMessageId?: number | null;
  replyToMessage?: ReplyToMessagePreview | null;
  isEdited?: boolean;
  editedAt?: string | null;
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
