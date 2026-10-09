"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import UserSearch from "@/components/user/UserSearch";
import ProfileModal from "@/components/profile/ProfileModal";
import CreateGroupModal from "@/components/conversation/CreateGroupModal";
import { getMyProfile } from "@/services/user.service";
import {
  createConversation,
  getConversationDetails,
  getMyConversations,
  Conversation,
} from "@/services/conversation.service";
import { User } from "@/types/auth";
import { useAuthStore } from "@/store/auth.store";
import { connectSocket } from "@/lib/socket";
import { getToken } from "@/lib/auth";
import { getLastMessagePreview, getAttachmentUrl } from "@/lib/file";
import NotificationBell from "@/components/notification/NotificationBell";
import { useNotificationStore } from "@/store/notification.store";
import { AppNotification } from "@/types/notification";
import {
  triggerBrowserNotification,
  getBrowserNotificationPermission,
} from "@/utils/browserNotification";

interface NewMessagePayload {
  id: number;
  conversationId: number;
  senderId: number;
  senderName?: string | null;
  senderAvatar?: string | null;
  type?: "TEXT" | "SYSTEM";
  content: string | null;
  isDelivered?: boolean;
  isRead?: boolean;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  attachmentSize?: number | null;
  createdAt: string;
  updatedAt?: string;
}

interface ConversationUpdatedPayload {
  conversationId: number;
  lastMessage: {
    id: number;
    conversationId: number;
    senderId: number;
    content: string | null;
    type?: "TEXT" | "SYSTEM";
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    attachmentType?: string | null;
    attachmentSize?: number | null;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

interface UnreadCountUpdatedPayload {
  conversationId: number;
  userId: number;
  unreadCount: number;
}

export function ConversationList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useAuthStore((state) => state.user);

  const selectedConversationId =
    Number(searchParams.get("conversationId")) || null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // ========================================
  // LOAD USER PROFILE ON MOUNT IF NOT SET
  // ========================================

  useEffect(() => {
    const loadProfile = async () => {
      const token = getToken();
      if (token && !currentUser) {
        try {
          const userProfile = await getMyProfile();
          useAuthStore.getState().setUser(userProfile);
        } catch (error) {
          console.error("Fetch current user profile error:", error);
        }
      }
    };

    loadProfile();
  }, [currentUser]);

  // ========================================
  // LOAD CONVERSATIONS ON MOUNT
  // ========================================

  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        const conversationList = await getMyConversations();
        setConversations(Array.isArray(conversationList) ? conversationList : []);
      } catch (error) {
        console.error("Load conversations error:", error);
        setConversations([]);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, []);

  // ========================================
  // RESET UNREAD COUNT FOR OPEN CONVERSATION
  // ========================================

  const [trackedSelectedId, setTrackedSelectedId] = useState<number | null>(selectedConversationId);

  if (selectedConversationId !== trackedSelectedId) {
    setTrackedSelectedId(selectedConversationId);
    if (selectedConversationId) {
      setConversations((prevList) =>
        prevList.map((conv) =>
          conv.id === selectedConversationId ? { ...conv, unreadCount: 0 } : conv
        )
      );
    }
  }

  // ========================================
  // SOCKET REALTIME SIDEBAR UPDATES
  // ========================================

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const socket = connectSocket(token);

    const handleNewMessage = async (newMessage: NewMessagePayload) => {
      console.log("SIDEBAR NEW MESSAGE:", newMessage);
      const convId = Number(newMessage.conversationId);
      const isCurrentlySelected = selectedConversationId === convId;
      const isFromMe = Number(newMessage.senderId) === Number(currentUser?.id);

      if (!isFromMe) {
        socket.emit("message_delivered", {
          messageId: newMessage.id,
          conversationId: newMessage.conversationId,
        });
      }

      setConversations((prevList) => {
        const existingIndex = prevList.findIndex((item) => item.id === convId);

        if (existingIndex !== -1) {
          const existingConv = prevList[existingIndex];
          const newUnreadCount =
            isCurrentlySelected || isFromMe
              ? 0
              : existingConv.unreadCount + 1;

          const updatedConv: Conversation = {
            ...existingConv,
            lastMessage: {
              id: newMessage.id,
              content: newMessage.content,
              senderId: newMessage.senderId,
              createdAt: newMessage.createdAt,
              type: newMessage.type || "TEXT",
              attachmentUrl: newMessage.attachmentUrl ?? null,
              attachmentName: newMessage.attachmentName ?? null,
              attachmentType: newMessage.attachmentType ?? null,
              attachmentSize: newMessage.attachmentSize ?? null,
            },
            unreadCount: newUnreadCount,
            updatedAt: newMessage.createdAt,
          };

          const updatedList = [...prevList];
          updatedList.splice(existingIndex, 1);
          return [updatedConv, ...updatedList];
        }

        return prevList;
      });

      // If conversation was not in list yet, fetch details and prepend to top
      setConversations((prevList) => {
        const exists = prevList.some((item) => item.id === convId);
        if (!exists) {
          getConversationDetails(convId)
            .then((details) => {
              if (details) {
                const initialUnread = isCurrentlySelected || isFromMe ? 0 : 1;
                const newConvItem: Conversation = {
                  ...details,
                  unreadCount: initialUnread,
                  lastMessage: {
                    id: newMessage.id,
                    content: newMessage.content,
                    senderId: newMessage.senderId,
                    createdAt: newMessage.createdAt,
                    type: newMessage.type || "TEXT",
                    attachmentUrl: newMessage.attachmentUrl ?? null,
                    attachmentName: newMessage.attachmentName ?? null,
                    attachmentType: newMessage.attachmentType ?? null,
                    attachmentSize: newMessage.attachmentSize ?? null,
                  },
                  updatedAt: newMessage.createdAt,
                };

                setConversations((current) => [
                  newConvItem,
                  ...current.filter((c) => c.id !== convId),
                ]);
              }
            })
            .catch((err) => console.error("Fetch new conv details error:", err));
        }
        return prevList;
      });
    };

    const handleConversationUpdated = (data: ConversationUpdatedPayload) => {
      const convId = Number(data.conversationId);
      const isCurrentlySelected = selectedConversationId === convId;

      setConversations((prevList) => {
        const existingIndex = prevList.findIndex((item) => item.id === convId);

        if (existingIndex !== -1) {
          const existingConv = prevList[existingIndex];
          const newUnread = isCurrentlySelected ? 0 : data.unreadCount;

          const updatedConv: Conversation = {
            ...existingConv,
            lastMessage: data.lastMessage,
            unreadCount: newUnread,
            updatedAt: data.updatedAt,
          };

          const updatedList = [...prevList];
          updatedList.splice(existingIndex, 1);
          return [updatedConv, ...updatedList];
        } else {
          getConversationDetails(convId)
            .then((details) => {
              if (details) {
                setConversations((current) => [
                  { ...details, unreadCount: isCurrentlySelected ? 0 : data.unreadCount },
                  ...current.filter((c) => c.id !== convId),
                ]);
              }
            })
            .catch((err) => console.error("Fetch restored conv error:", err));
        }

        return prevList;
      });
    };

    const handleUnreadCountUpdated = (data: UnreadCountUpdatedPayload) => {
      if (currentUser?.id && Number(data.userId) !== Number(currentUser.id)) {
        return;
      }

      const convId = Number(data.conversationId);
      const isCurrentlySelected = selectedConversationId === convId;
      const targetUnread = isCurrentlySelected ? 0 : data.unreadCount;

      setConversations((prevList) =>
        prevList.map((conv) =>
          conv.id === convId ? { ...conv, unreadCount: targetUnread } : conv
        )
      );
    };

    const handleMessageDeleted = (data: {
      messageId: number;
      conversationId: number;
      deleteType?: string;
    }) => {
      const convId = Number(data.conversationId);
      if (!convId || Number.isNaN(convId)) return;

      setConversations((prevList) =>
        prevList.map((conv) => {
          if (conv.id !== convId || !conv.lastMessage) {
            return conv;
          }

          const isTargetMessage =
            Number(conv.lastMessage.id) === Number(data.messageId);

          if (!isTargetMessage) {
            return conv;
          }

          return {
            ...conv,
            lastMessage: {
              ...conv.lastMessage,
              content: "This message was deleted",
              attachmentUrl: null,
              attachmentName: null,
              attachmentType: null,
              attachmentSize: null,
              isDeleted: true,
            },
            updatedAt: new Date().toISOString(),
          };
        })
      );
    };

    const handleConversationDeleted = (data: { conversationId: number }) => {
      const convId = Number(data.conversationId);
      if (!convId || Number.isNaN(convId)) return;

      setConversations((prevList) => prevList.filter((item) => item.id !== convId));

      if (selectedConversationId === convId) {
        router.push("/chat");
      }
    };

    const handleGroupCreated = (group: Conversation) => {
      setConversations((prev) => [group, ...prev.filter((c) => c.id !== group.id)]);
    };

    const handleGroupUpdated = (data: Partial<Conversation> & { conversationId: number }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === data.conversationId) {
            return {
              ...c,
              name: data.name ?? c.name,
              avatar: data.avatar !== undefined ? data.avatar : c.avatar,
              updatedAt: data.updatedAt || c.updatedAt,
            };
          }
          return c;
        })
      );
    };

    const handleGroupMemberAdded = (data: { conversationId: number; memberCount?: number; members?: any[] }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === data.conversationId) {
            return {
              ...c,
              memberCount: data.memberCount ?? (data.members ? data.members.length : c.memberCount),
              members: data.members ?? c.members,
            };
          }
          return c;
        })
      );
    };

    const handleGroupMemberRemoved = (data: { conversationId: number; memberCount?: number; members?: any[]; removedUserId?: number }) => {
      if (data.removedUserId && Number(data.removedUserId) === Number(currentUser?.id)) {
        setConversations((prev) => prev.filter((c) => c.id !== data.conversationId));
        if (selectedConversationId === data.conversationId) {
          router.push("/chat");
        }
        return;
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === data.conversationId) {
            return {
              ...c,
              memberCount: data.memberCount ?? (data.members ? data.members.length : c.memberCount),
              members: data.members ?? c.members,
            };
          }
          return c;
        })
      );
    };

    const handleGroupMemberLeft = (data: { conversationId: number; memberCount?: number; members?: any[]; leftUserId?: number }) => {
      if (data.leftUserId && Number(data.leftUserId) === Number(currentUser?.id)) {
        setConversations((prev) => prev.filter((c) => c.id !== data.conversationId));
        if (selectedConversationId === data.conversationId) {
          router.push("/chat");
        }
        return;
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === data.conversationId) {
            return {
              ...c,
              memberCount: data.memberCount ?? (data.members ? data.members.length : c.memberCount),
              members: data.members ?? c.members,
            };
          }
          return c;
        })
      );
    };

    const handleNotificationNew = (data: AppNotification & { unreadCount?: number }) => {
      console.log("REALTIME NOTIFICATION RECEIVED:", data);
      useNotificationStore.getState().addNotification(data);

      const convId = data.conversationId ? Number(data.conversationId) : null;
      const isCurrentlySelected = convId !== null && selectedConversationId === convId;

      if (isCurrentlySelected) {
        if (data.id) {
          useNotificationStore.getState().markAsRead(data.id);
        }
      } else {
        const { browserEnabled } = useNotificationStore.getState();
        if (browserEnabled && getBrowserNotificationPermission() === "granted") {
          triggerBrowserNotification(data.title, {
            body: data.message,
            icon: data.actorAvatar ? getAttachmentUrl(data.actorAvatar) : "/favicon.ico",
            onClick: () => {
              if (data.conversationId) {
                let url = `/chat?conversationId=${data.conversationId}`;
                if (data.messageId) url += `&messageId=${data.messageId}`;
                router.push(url);
              }
            },
          });
        }
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("conversation_updated", handleConversationUpdated);
    socket.on("unread_count_updated", handleUnreadCountUpdated);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("conversation_deleted", handleConversationDeleted);
    socket.on("notification_new", handleNotificationNew);

    socket.on("group_created", handleGroupCreated);
    socket.on("group_updated", handleGroupUpdated);
    socket.on("group_member_added", handleGroupMemberAdded);
    socket.on("group_member_removed", handleGroupMemberRemoved);
    socket.on("group_member_left", handleGroupMemberLeft);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("conversation_updated", handleConversationUpdated);
      socket.off("unread_count_updated", handleUnreadCountUpdated);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("conversation_deleted", handleConversationDeleted);
      socket.off("notification_new", handleNotificationNew);

      socket.off("group_created", handleGroupCreated);
      socket.off("group_updated", handleGroupUpdated);
      socket.off("group_member_added", handleGroupMemberAdded);
      socket.off("group_member_removed", handleGroupMemberRemoved);
      socket.off("group_member_left", handleGroupMemberLeft);
    };
  }, [selectedConversationId, currentUser?.id, router]);

  // ========================================
  // CREATE / SELECT CONVERSATION
  // ========================================

  const handleUserSelect = async (user: User) => {
    try {
      setCreating(true);

      let targetConvId: number | null = null;

      const existingConversation = conversations.find(
        (conv) =>
          conv.type !== "GROUP" &&
          conv.otherUser &&
          Number(conv.otherUser.id) === Number(user.id)
      );

      if (existingConversation) {
        targetConvId = existingConversation.id;
      } else if (user.hasActiveConversation && user.conversationId) {
        targetConvId = Number(user.conversationId);
      }

      if (targetConvId) {
        setConversations((prevList) =>
          prevList.map((conv) =>
            conv.id === targetConvId
              ? { ...conv, unreadCount: 0 }
              : conv
          )
        );

        router.push(`/chat?conversationId=${targetConvId}`);
        return;
      }

      const result = await createConversation(user.id);
      const conversationId = Number(result.conversation.id);

      const details = await getConversationDetails(conversationId);

      setConversations((previous) => [
        {
          id: conversationId,
          type: "DIRECT",
          otherUser: details.otherUser,
          lastMessage: details.lastMessage || null,
          unreadCount: 0,
          createdAt: details.createdAt,
          updatedAt: details.updatedAt,
        },
        ...previous.filter((c) => c.id !== conversationId),
      ]);

      router.push(`/chat?conversationId=${conversationId}`);
    } catch (error) {
      console.error("Create conversation error:", error);
      alert("Unable to start conversation");
    } finally {
      setCreating(false);
    }
  };

  const handleGroupCreated = (group: Conversation) => {
    setConversations((prev) => [group, ...prev.filter((c) => c.id !== group.id)]);
    router.push(`/chat?conversationId=${group.id}`);
  };

  const handleConversationClick = (conversationId: number) => {
    setConversations((prevList) =>
      prevList.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      )
    );

    router.push(`/chat?conversationId=${conversationId}`);
  };

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return "";
    const messageDate = new Date(dateStr);
    if (Number.isNaN(messageDate.getTime())) return "";

    return messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      {/* Modals */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={handleGroupCreated}
      />

      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        {currentUser && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-gray-50 p-2.5 border border-gray-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-semibold text-blue-600 border border-blue-200">
                {currentUser.avatar ? (
                  <img
                    src={getAttachmentUrl(currentUser.avatar)}
                    alt={currentUser.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "?"
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800">
                  {currentUser.name}
                </p>
                <p className="truncate text-[11px] text-gray-500">
                  {currentUser.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-white hover:text-blue-600 hover:shadow-sm transition"
                title="Edit Profile"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Conversations</h3>
          <button
            type="button"
            onClick={() => setIsCreateGroupOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100 border border-blue-200 transition"
            title="Create New Group"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Group
          </button>
        </div>

        <UserSearch onUserSelect={handleUserSelect} />
        {creating && (
          <p className="mt-2 text-xs text-blue-500">Opening conversation...</p>
        )}
      </div>

      {/* Conversation List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-5 text-center">
            <p className="text-sm text-gray-400">Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-5 text-center">
            <p className="text-sm text-gray-400">No active conversations</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {conversations.map((conversation) => {
              const isGroup = conversation.type === "GROUP";
              const isSelected = selectedConversationId === conversation.id;
              const displayTime = formatTime(
                conversation.lastMessage
                  ? conversation.lastMessage.createdAt
                  : conversation.updatedAt
              );

              const user = conversation.otherUser;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => handleConversationClick(conversation.id)}
                  className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition ${
                    isSelected ? "bg-blue-50" : "bg-white hover:bg-gray-50"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-semibold text-blue-600">
                    {isGroup ? (
                      conversation.avatar ? (
                        <img
                          src={getAttachmentUrl(conversation.avatar)}
                          alt={conversation.name || "Group"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center bg-indigo-100 text-indigo-600 h-full w-full font-bold text-sm">
                          {(conversation.name || "G").charAt(0).toUpperCase()}
                        </div>
                      )
                    ) : user?.avatar ? (
                      <img
                        src={getAttachmentUrl(user.avatar)}
                        alt={user.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      user?.name ? user.name.charAt(0).toUpperCase() : "?"
                    )}

                    {!isGroup && user?.isOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                    )}

                    {isGroup && (
                      <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 border border-white text-[9px] font-bold text-white shadow-sm" title="Group Chat">
                        👥
                      </span>
                    )}
                  </div>

                  {/* Info & Preview */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="truncate text-sm font-semibold text-gray-800">
                        {isGroup
                          ? conversation.name || "Group Chat"
                          : user?.name}
                      </h4>

                      <span className="shrink-0 text-[11px] text-gray-400">
                        {displayTime}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-gray-500">
                        {isGroup && conversation.lastMessage && conversation.lastMessage.type === "SYSTEM" ? (
                          <span className="italic text-gray-400">
                            {conversation.lastMessage.content}
                          </span>
                        ) : (
                          getLastMessagePreview(conversation.lastMessage)
                        )}
                      </p>

                      {/* Unread Badge */}
                      {conversation.unreadCount > 0 && (
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
                          {conversation.unreadCount > 99
                            ? "99+"
                            : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ConversationList;