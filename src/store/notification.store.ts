import { create } from "zustand";
import { AppNotification } from "@/types/notification";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "@/services/notification.service";

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  page: number;
  hasMore: boolean;
  browserEnabled: boolean;

  fetchNotifications: (resetPage?: boolean) => Promise<void>;
  addNotification: (notification: AppNotification & { unreadCount?: number }) => void;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markConversationAsReadInStore: (conversationId: number) => void;
  removeNotification: (id: number) => Promise<void>;
  setUnreadCount: (count: number) => void;
  toggleBrowserEnabled: () => void;
  clearStore: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  page: 1,
  hasMore: false,
  browserEnabled:
    typeof window !== "undefined" &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted",

  fetchNotifications: async (resetPage = false) => {
    try {
      set({ loading: true });
      const targetPage = resetPage ? 1 : get().page;
      const data = await getNotifications(targetPage, 20);

      set((state) => {
        const newNotifs = resetPage
          ? data.notifications
          : [
              ...state.notifications,
              ...data.notifications.filter(
                (n) => !state.notifications.some((existing) => existing.id === n.id)
              ),
            ];

        return {
          notifications: newNotifs,
          unreadCount: data.unreadCount,
          loading: false,
          page: targetPage + 1,
          hasMore: data.hasMore,
        };
      });
    } catch (error) {
      console.error("Fetch notifications store error:", error);
      set({ loading: false });
    }
  },

  addNotification: (incoming) => {
    set((state) => {
      // Prevent duplicate notification addition
      const exists = state.notifications.some(
        (n) =>
          n.id === incoming.id ||
          (incoming.messageId &&
            n.messageId === incoming.messageId &&
            n.createdAt === incoming.createdAt)
      );

      if (exists) return state;

      const updatedList = [incoming, ...state.notifications];
      const newUnreadCount =
        typeof incoming.unreadCount === "number"
          ? incoming.unreadCount
          : incoming.isRead
          ? state.unreadCount
          : state.unreadCount + 1;

      return {
        notifications: updatedList,
        unreadCount: newUnreadCount,
      };
    });
  },

  markAsRead: async (id) => {
    try {
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(
          0,
          state.unreadCount -
            (state.notifications.find((n) => n.id === id && !n.isRead) ? 1 : 0)
        ),
      }));

      const res = await markNotificationAsRead(id);
      set({ unreadCount: res.unreadCount });
    } catch (error) {
      console.error("Mark as read store error:", error);
    }
  },

  markAllAsRead: async () => {
    try {
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));

      await markAllNotificationsAsRead();
      set({ unreadCount: 0 });
    } catch (error) {
      console.error("Mark all as read store error:", error);
    }
  },

  markConversationAsReadInStore: (conversationId) => {
    set((state) => {
      let unreadCleared = 0;
      const updated = state.notifications.map((n) => {
        if (n.conversationId === conversationId && !n.isRead) {
          unreadCleared++;
          return { ...n, isRead: true };
        }
        return n;
      });

      return {
        notifications: updated,
        unreadCount: Math.max(0, state.unreadCount - unreadCleared),
      };
    });
  },

  removeNotification: async (id) => {
    try {
      set((state) => {
        const target = state.notifications.find((n) => n.id === id);
        const wasUnread = target ? !target.isRead : false;
        return {
          notifications: state.notifications.filter((n) => n.id !== id),
          unreadCount: wasUnread
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
        };
      });

      const res = await deleteNotification(id);
      set({ unreadCount: res.unreadCount });
    } catch (error) {
      console.error("Delete notification store error:", error);
    }
  },

  setUnreadCount: (count) => {
    set({ unreadCount: Math.max(0, count) });
  },

  toggleBrowserEnabled: () => {
    set((state) => ({ browserEnabled: !state.browserEnabled }));
  },

  clearStore: () => {
    set({
      notifications: [],
      unreadCount: 0,
      loading: false,
      page: 1,
      hasMore: false,
    });
  },
}));
