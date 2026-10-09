import api from "@/lib/axios";
import { AppNotification, NotificationsResponse } from "@/types/notification";

export async function getNotifications(page = 1, limit = 20): Promise<NotificationsResponse> {
  const response = await api.get<NotificationsResponse>("/notifications", {
    params: { page, limit },
  });
  return response.data;
}

export async function markNotificationAsRead(
  notificationId: number
): Promise<{ success: boolean; notification?: AppNotification; unreadCount: number }> {
  const response = await api.patch<{
    success: boolean;
    notification?: AppNotification;
    unreadCount: number;
  }>(`/notifications/${notificationId}/read`);
  return response.data;
}

export async function markAllNotificationsAsRead(): Promise<{
  success: boolean;
  unreadCount: number;
}> {
  const response = await api.patch<{ success: boolean; unreadCount: number }>(
    "/notifications/read-all"
  );
  return response.data;
}

export async function deleteNotification(
  notificationId: number
): Promise<{ success: boolean; unreadCount: number }> {
  const response = await api.delete<{ success: boolean; unreadCount: number }>(
    `/notifications/${notificationId}`
  );
  return response.data;
}
