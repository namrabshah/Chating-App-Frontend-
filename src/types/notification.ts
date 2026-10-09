export type NotificationType = "MESSAGE" | "MENTION" | "GROUP_EVENT";

export interface AppNotification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  conversationId: number | null;
  messageId: number | null;
  actorId: number | null;
  actorName?: string | null;
  actorAvatar?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  success: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
