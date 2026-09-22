"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import UserSearch from "@/components/user/UserSearch";
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

interface NewMessagePayload {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  isDelivered?: boolean;
  isRead?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface ConversationUpdatedPayload {
  conversationId: number;
  lastMessage: {
    id: number;
    conversationId: number;
    senderId: number;
    content: string;
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

  useEffect(() => {
    if (!selectedConversationId || Number.isNaN(selectedConversationId)) return;

    console.log("CURRENT OPEN CONVERSATION:", selectedConversationId);
    console.log("[FRONTEND] CONVERSATION OPENED", selectedConversationId);
    console.log("[FRONTEND] UNREAD COUNT RESET", selectedConversationId);

    setConversations((prevList) =>
      prevList.map((conv) =>
        conv.id === selectedConversationId ? { ...conv, unreadCount: 0 } : conv
      )
    );
  }, [selectedConversationId]);

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

    socket.on("new_message", handleNewMessage);
    socket.on("conversation_updated", handleConversationUpdated);
    socket.on("unread_count_updated", handleUnreadCountUpdated);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("conversation_updated", handleConversationUpdated);
      socket.off("unread_count_updated", handleUnreadCountUpdated);
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
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
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
                        {conversation.lastMessage
                          ? conversation.lastMessage.content
                          : "No messages yet"}
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