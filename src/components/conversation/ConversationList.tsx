"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import UserSearch from "@/components/user/UserSearch";
import ProfileModal from "@/components/profile/ProfileModal";
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

interface NewMessagePayload {
  id: number;
  conversationId: number;
  senderId: number;
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
      console.log("DELIVERY DEBUG - NEW MESSAGE:", {
        messageId: newMessage.id,
        conversationId: newMessage.conversationId,
        senderId: newMessage.senderId,
        currentUserId: currentUser?.id,
      });

      console.log("RECIPIENT:");
      console.log("NEW MESSAGE RECEIVED", newMessage);
      console.log("SIDEBAR NEW MESSAGE:", newMessage);
      console.log("CURRENT OPEN CONVERSATION:", selectedConversationId);
      console.log("[FRONTEND] NEW MESSAGE FOR SIDEBAR", newMessage);

      const convId = Number(newMessage.conversationId);
      const isCurrentlySelected = selectedConversationId === convId;
      const isFromMe = Number(newMessage.senderId) === Number(currentUser?.id);

      // Emit delivery ACK if recipient is online and message is from another user
      if (!isFromMe) {
        console.log("DELIVERY DEBUG - SENDING ACK:", {
          messageId: newMessage.id,
          conversationId: newMessage.conversationId,
        });

        socket.emit("message_delivered", {
          messageId: newMessage.id,
          conversationId: newMessage.conversationId,
        });

        console.log("DELIVERY DEBUG - ACK EMITTED");
      }

      setConversations((prevList) => {
        const existingIndex = prevList.findIndex((item) => item.id === convId);

        if (existingIndex !== -1) {
          const existingConv = prevList[existingIndex];
          const newUnreadCount =
            isCurrentlySelected || isFromMe
              ? 0
              : existingConv.unreadCount + 1;

          console.log("UPDATED UNREAD COUNT:", newUnreadCount);
          if (!isCurrentlySelected && !isFromMe) {
            console.log("[FRONTEND] UNREAD COUNT UPDATED", {
              conversationId: convId,
              unreadCount: newUnreadCount,
            });
          }

          const updatedConv: Conversation = {
            ...existingConv,
            lastMessage: {
              id: newMessage.id,
              content: newMessage.content,
              senderId: newMessage.senderId,
              createdAt: newMessage.createdAt,
              attachmentUrl: newMessage.attachmentUrl ?? null,
              attachmentName: newMessage.attachmentName ?? null,
              attachmentType: newMessage.attachmentType ?? null,
              attachmentSize: newMessage.attachmentSize ?? null,
            },
            unreadCount: newUnreadCount,
            updatedAt: newMessage.createdAt,
          };

          console.log("CONVERSATION MOVED TO TOP");
          console.log("[FRONTEND] CONVERSATION MOVED TO TOP", convId);

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
                    attachmentUrl: newMessage.attachmentUrl ?? null,
                    attachmentName: newMessage.attachmentName ?? null,
                    attachmentType: newMessage.attachmentType ?? null,
                    attachmentSize: newMessage.attachmentSize ?? null,
                  },
                  updatedAt: newMessage.createdAt,
                };

                console.log("CONVERSATION MOVED TO TOP");
                console.log("[FRONTEND] CONVERSATION MOVED TO TOP", convId);
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

          console.log("CONVERSATION MOVED TO TOP");
          console.log("[FRONTEND] CONVERSATION MOVED TO TOP", convId);

          const updatedList = [...prevList];
          updatedList.splice(existingIndex, 1);
          return [updatedConv, ...updatedList];
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

      console.log("UPDATED UNREAD COUNT:", targetUnread);
      console.log("[FRONTEND] UNREAD COUNT UPDATED", {
        conversationId: convId,
        unreadCount: targetUnread,
      });

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

    socket.on("new_message", handleNewMessage);
    socket.on("conversation_updated", handleConversationUpdated);
    socket.on("unread_count_updated", handleUnreadCountUpdated);
    socket.on("message_deleted", handleMessageDeleted);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("conversation_updated", handleConversationUpdated);
      socket.off("unread_count_updated", handleUnreadCountUpdated);
      socket.off("message_deleted", handleMessageDeleted);
    };
  }, [selectedConversationId, currentUser?.id]);

  // ========================================
  // CREATE / SELECT CONVERSATION
  // ========================================

  const handleUserSelect = async (user: User) => {
    try {
      setCreating(true);

      const existingConversation = conversations.find(
        (conv) => conv.otherUser.id === user.id
      );

      if (existingConversation) {
        console.log("CURRENT OPEN CONVERSATION:", existingConversation.id);
        console.log("[FRONTEND] CONVERSATION OPENED", existingConversation.id);
        console.log("[FRONTEND] UNREAD COUNT RESET", existingConversation.id);

        setConversations((prevList) =>
          prevList.map((conv) =>
            conv.id === existingConversation.id
              ? { ...conv, unreadCount: 0 }
              : conv
          )
        );

        router.push(`/chat?conversationId=${existingConversation.id}`);
        return;
      }

      const result = await createConversation(user.id);
      const conversationId = result.conversation.id;

      const details = await getConversationDetails(conversationId);

      setConversations((previous) => [
        {
          id: conversationId,
          otherUser: details.otherUser,
          lastMessage: null,
          unreadCount: 0,
          createdAt: details.createdAt,
          updatedAt: details.updatedAt,
        },
        ...previous,
      ]);

      console.log("CURRENT OPEN CONVERSATION:", conversationId);
      console.log("[FRONTEND] CONVERSATION OPENED", conversationId);
      console.log("[FRONTEND] UNREAD COUNT RESET", conversationId);

      router.push(`/chat?conversationId=${conversationId}`);
    } catch (error) {
      console.error("Create conversation error:", error);
      alert("Unable to start conversation");
    } finally {
      setCreating(false);
    }
  };

  const handleConversationClick = (conversationId: number) => {
    console.log("CURRENT OPEN CONVERSATION:", conversationId);
    console.log("[FRONTEND] CONVERSATION OPENED", conversationId);
    console.log("[FRONTEND] UNREAD COUNT RESET", conversationId);

    setConversations((prevList) =>
      prevList.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      )
    );

    router.push(`/chat?conversationId=${conversationId}`);
  };

  // ========================================
  // FORMAT TIME HELPER
  // ========================================

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return "";
    const messageDate = new Date(dateStr);
    if (Number.isNaN(messageDate.getTime())) return "";

    return messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ========================================
  // UI RENDER
  // ========================================

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        {currentUser && (
          <div className="mb-3.5 flex items-center justify-between gap-2 rounded-xl bg-gray-50 p-2.5 border border-gray-100">
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
        )}
        <h3 className="mb-3 font-semibold text-gray-800">Conversations</h3>
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
              const user = conversation.otherUser;
              const isSelected = selectedConversationId === conversation.id;
              const displayTime = formatTime(
                conversation.lastMessage
                  ? conversation.lastMessage.createdAt
                  : conversation.updatedAt
              );

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
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      user.name ? user.name.charAt(0).toUpperCase() : "?"
                    )}

                    {user.isOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                    )}
                  </div>

                  {/* User Info & Preview */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="truncate text-sm font-semibold text-gray-800">
                        {user.name}
                      </h4>

                      <span className="shrink-0 text-[11px] text-gray-400">
                        {displayTime}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-gray-500">
                        {getLastMessagePreview(conversation.lastMessage)}
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