"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";

import { getConversationDetails, deleteConversation, Conversation, GroupMember } from "@/services/conversation.service";
import {
  getMessages,
  sendMessage,
  searchMessages,
  editMessage,
  deleteMessage,
  markConversationAsRead,
  toggleMessageReaction,
  Message,
  ReplyToMessagePreview,
} from "@/services/message.services";
import { MessageReaction } from "@/types/message";
import { ReactionPicker } from "@/components/chat/ReactionPicker";
import GroupInfoModal from "@/components/conversation/GroupInfoModal";

import { useAuthStore } from "@/store/auth.store";
import { getBlockStatus, blockUser, unblockUser } from "@/services/user.service";
import { BlockStatus } from "@/types/auth";
import { connectSocket } from "@/lib/socket";
import { getToken } from "@/lib/auth";
import {
  ACCEPTED_FILE_TYPES,
  validateAttachmentFile,
  isDocumentType,
  getAttachmentUrl,
} from "@/lib/file";
import { AttachmentPreview } from "@/components/chat/AttachmentPreview";
import { AttachmentMessage } from "@/components/chat/AttachmentMessage";

interface DeliveryUpdate {
  messageId: number;
  conversationId: number;
  senderId: number;
  recipientId: number;
  isDelivered: boolean;
}

interface ReadUpdate {
  messageId: number;
  conversationId: number;
  senderId: number;
  recipientId: number;
  isRead: boolean;
}

interface TypingEvent {
  userId: number;
  conversationId: number;
  userName?: string;
}

function getReplyPreviewLabel(
  msg: Message | ReplyToMessagePreview | null
): string {
  if (!msg) return "Message deleted";
  if (msg.content === "Message deleted" || msg.content === "This message was deleted" || msg.isDeleted) {
    return "Message deleted";
  }
  const content = msg.content?.trim();
  if (content) return content;

  const type = msg.attachmentType || "";
  const name = msg.attachmentName || "file";

  if (type.startsWith("image/")) return "📷 Image";
  if (type.startsWith("audio/")) return `🎵 ${name}`;
  if (type.startsWith("video/")) return `🎥 ${name}`;
  if (type === "application/pdf" || isDocumentType(type)) return `📄 ${name}`;
  if (msg.attachmentName || msg.attachmentType || msg.attachmentUrl)
    return `📎 ${name}`;

  return "Message";
}

function getSenderName(
  senderId: number,
  currentUserId?: number | null,
  fallbackName?: string,
  members?: GroupMember[]
): string {
  if (currentUserId && Number(senderId) === Number(currentUserId)) {
    return "You";
  }
  if (members && members.length > 0) {
    const found = members.find((m) => Number(m.id) === Number(senderId));
    if (found) return found.name;
  }
  return fallbackName || "User";
}

export function ChatWindow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationIdParam = searchParams.get("conversationId");
  const messageIdParam = searchParams.get("messageId");
  const targetMessageId = messageIdParam ? Number(messageIdParam) : null;

  const currentUser = useAuthStore((state) => state.user);

  const [conversation, setConversation] = useState<Conversation | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Typing users map/list for groups & direct chats
  const [typingUserIds, setTypingUserIds] = useState<number[]>([]);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingOriginalMessage, setEditingOriginalMessage] = useState<Message | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const [messageMenuId, setMessageMenuId] = useState<number | null>(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<number | null>(null);
  const [deleteConfirmMessageId, setDeleteConfirmMessageId] = useState<number | null>(null);

  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingOlder, setLoadingOlder] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);
  const activeTypingConvIdRef = useRef<number | null>(null);
  const currentUserRef = useRef(currentUser);
  const isInitialLoadRef = useRef<boolean>(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [blockStatus, setBlockStatus] = useState<BlockStatus>({
    isBlocked: false,
    blockedByUser: false,
    userBlockedMe: false,
  });
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [blockConfirmDialog, setBlockConfirmDialog] = useState<"block" | "unblock" | null>(null);
  const [blockActionLoading, setBlockActionLoading] = useState(false);

  const [showDeleteConvModal, setShowDeleteConvModal] = useState(false);
  const [deleteConvLoading, setDeleteConvLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDeleteConvModal) setShowDeleteConvModal(false);
        if (blockConfirmDialog) setBlockConfirmDialog(null);
        if (showBlockMenu) setShowBlockMenu(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDeleteConvModal, blockConfirmDialog, showBlockMenu]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    if (targetMessageId && messages.length > 0) {
      const el = document.getElementById(`message-${targetMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedMessageId(targetMessageId);
        const timer = setTimeout(() => {
          setHighlightedMessageId(null);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [targetMessageId, messages]);

  const conversationId = conversationIdParam ? Number(conversationIdParam) : null;
  const isGroup = conversation?.type === "GROUP";

  // Reset typing UI & pagination immediately when switching conversations
  const [typingTrackedConversationId, setTypingTrackedConversationId] =
    useState<number | null>(conversationId);

  if (conversationId !== typingTrackedConversationId) {
    setTypingTrackedConversationId(conversationId);
    setConversation(null);
    setMessages([]);
    setLoading(true);
    setTypingUserIds([]);
    setReplyingTo(null);
    setEditingMessageId(null);
    setEditingOriginalMessage(null);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearching(false);
    setHighlightedMessageId(null);
    setPage(1);
    setHasMore(true);
    setLoadingOlder(false);
    setShowBlockMenu(false);
    setBlockConfirmDialog(null);
    setShowDeleteConvModal(false);
    setIsGroupInfoOpen(false);
    isInitialLoadRef.current = true;
  }

  // Fetch block status ONLY for 1-to-1 direct chats
  useEffect(() => {
    if (isGroup) {
      setBlockStatus({
        isBlocked: false,
        blockedByUser: false,
        userBlockedMe: false,
      });
      return;
    }

    const targetUserId = conversation?.otherUser?.id;
    if (!targetUserId) {
      setBlockStatus({
        isBlocked: false,
        blockedByUser: false,
        userBlockedMe: false,
      });
      return;
    }

    let isMounted = true;
    getBlockStatus(targetUserId)
      .then((status) => {
        if (isMounted) {
          setBlockStatus(status);
        }
      })
      .catch((err) => {
        console.error("Fetch block status error:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [conversation?.otherUser?.id, isGroup]);

  const handleConfirmBlock = async () => {
    const targetUserId = conversation?.otherUser?.id;
    if (!targetUserId || blockActionLoading) return;

    try {
      setBlockActionLoading(true);
      await blockUser(targetUserId);
      setBlockStatus((prev) => ({
        ...prev,
        isBlocked: true,
        blockedByUser: true,
      }));
      setBlockConfirmDialog(null);
      setShowBlockMenu(false);
    } catch (err: any) {
      console.error("Failed to block user:", err);
      const msg = err?.response?.data?.message || "Failed to block user";
      setSendError(msg);
    } finally {
      setBlockActionLoading(false);
    }
  };

  const handleConfirmUnblock = async () => {
    const targetUserId = conversation?.otherUser?.id;
    if (!targetUserId || blockActionLoading) return;

    try {
      setBlockActionLoading(true);
      await unblockUser(targetUserId);
      setBlockStatus((prev) => ({
        ...prev,
        isBlocked: prev.userBlockedMe,
        blockedByUser: false,
      }));
      setBlockConfirmDialog(null);
      setShowBlockMenu(false);
    } catch (err: any) {
      console.error("Failed to unblock user:", err);
      const msg = err?.response?.data?.message || "Failed to unblock user";
      setSendError(msg);
    } finally {
      setBlockActionLoading(false);
    }
  };

  const handleConfirmDeleteConversation = async () => {
    if (!conversationId || deleteConvLoading) return;

    try {
      setDeleteConvLoading(true);
      await deleteConversation(conversationId);
      setShowDeleteConvModal(false);
      setShowBlockMenu(false);
      setConversation(null);
      setMessages([]);
      router.push("/chat");
      showToast("Conversation deleted");
    } catch (err: any) {
      console.error("Failed to delete conversation:", err);
      const msg = err?.response?.data?.message || "Failed to delete conversation";
      setSendError(msg);
    } finally {
      setDeleteConvLoading(false);
    }
  };

  const clearTypingTimeout = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const emitStopTyping = (targetConversationId: number | null) => {
    if (!targetConversationId || Number.isNaN(targetConversationId)) return;

    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("stop_typing", targetConversationId);
    }

    if (activeTypingConvIdRef.current === targetConversationId) {
      activeTypingConvIdRef.current = null;
    }
  };

  const handleScrollToMessage = (targetId: number) => {
    const element = document.getElementById(`message-${targetId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(targetId);
      setTimeout(() => {
        setHighlightedMessageId((prev) => (prev === targetId ? null : prev));
      }, 1500);
    }
  };

  const handleStartEditMessage = (message: Message) => {
    setReplyingTo(null);
    setEditingMessageId(message.id);
    setEditingOriginalMessage(message);
    setContent(message.content || "");
    setSendError(null);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingOriginalMessage(null);
    setContent("");
    setSendError(null);
  };

  const handleDeleteMessage = async (
    message: Message,
    deleteType: "me" | "everyone"
  ) => {
    try {
      setSendError(null);
      const response = await deleteMessage(message.id, deleteType);

      if (!response?.success) {
        throw new Error("Delete message request failed");
      }

      if (deleteType === "me") {
        setMessages((previousMessages) =>
          previousMessages.filter(
            (item) => Number(item.id) !== Number(message.id)
          )
        );
      } else {
        setMessages((previousMessages) =>
          previousMessages.map((item) =>
            Number(item.id) === Number(message.id)
              ? {
                  ...item,
                  isDeleted: true,
                  deletedAt: new Date().toISOString(),
                  content: null,
                  attachmentUrl: null,
                  attachmentName: null,
                  attachmentType: null,
                  attachmentSize: null,
                }
              : item
          )
        );
      }

      setMessageMenuId(null);
      setDeleteConfirmMessageId(null);
    } catch (error) {
      console.error("DELETE MESSAGE API ERROR:", error);
      let messageText = "Failed to delete message. Please try again.";

      if (axios.isAxiosError(error)) {
        const apiMessage = error.response?.data?.message;
        if (typeof apiMessage === "string" && apiMessage.trim()) {
          messageText = apiMessage;
        }
      }

      setSendError(messageText);
    }
  };

  const handleToggleReaction = async (messageId: number, emoji: string) => {
    setReactionPickerMessageId(null);

    const targetMessage = messages.find((m) => Number(m.id) === Number(messageId));
    if (!targetMessage || targetMessage.isDeleted) return;

    const previousReactions = targetMessage.reactions || [];
    const previousMyReaction = targetMessage.myReaction || null;

    let nextMyReaction: string | null = null;
    let nextReactions = [...previousReactions];

    if (previousMyReaction === emoji) {
      nextMyReaction = null;
      nextReactions = nextReactions
        .map((group) => {
          if (group.reaction === emoji) {
            const newUsers = (group.users || []).filter((u) => {
              const uid = typeof u === "object" ? u.id : u;
              return uid !== currentUser?.id;
            });
            return {
              ...group,
              count: group.count - 1,
              users: newUsers,
            };
          }
          return group;
        })
        .filter((group) => group.count > 0);
    } else {
      nextMyReaction = emoji;
      if (previousMyReaction) {
        nextReactions = nextReactions
          .map((group) => {
            if (group.reaction === previousMyReaction) {
              const newUsers = (group.users || []).filter((u) => {
                const uid = typeof u === "object" ? u.id : u;
                return uid !== currentUser?.id;
              });
              return {
                ...group,
                count: group.count - 1,
                users: newUsers,
              };
            }
            return group;
          })
          .filter((group) => group.count > 0);
      }

      const targetGroupIndex = nextReactions.findIndex(
        (g) => g.reaction === emoji
      );

      if (targetGroupIndex !== -1) {
        const existingUsers = nextReactions[targetGroupIndex].users || [];
        nextReactions[targetGroupIndex] = {
          ...nextReactions[targetGroupIndex],
          count: nextReactions[targetGroupIndex].count + 1,
          users: [
            ...existingUsers,
            { id: currentUser?.id || 0, name: currentUser?.name || "You" },
          ],
        };
      } else {
        nextReactions.push({
          reaction: emoji,
          count: 1,
          users: [
            { id: currentUser?.id || 0, name: currentUser?.name || "You" },
          ],
        });
      }
    }

    setMessages((previous) =>
      previous.map((m) =>
        Number(m.id) === Number(messageId)
          ? {
              ...m,
              reactions: nextReactions,
              myReaction: nextMyReaction,
            }
          : m
      )
    );

    try {
      const response = await toggleMessageReaction(messageId, emoji);

      if (!response?.success) {
        throw new Error("Reaction toggle failed");
      }

      setMessages((previous) =>
        previous.map((m) =>
          Number(m.id) === Number(messageId)
            ? {
                ...m,
                reactions: response.reactions,
                myReaction:
                  response.myReaction !== undefined
                    ? response.myReaction
                    : response.action === "removed"
                    ? null
                    : response.reaction,
              }
            : m
        )
      );
    } catch (error) {
      console.error("TOGGLE REACTION ERROR:", error);
      setMessages((previous) =>
        previous.map((m) =>
          Number(m.id) === Number(messageId)
            ? {
                ...m,
                reactions: previousReactions,
                myReaction: previousMyReaction,
              }
            : m
        )
      );

      let messageText = "Failed to update reaction. Please try again.";
      if (axios.isAxiosError(error)) {
        const apiMessage = error.response?.data?.message;
        if (typeof apiMessage === "string" && apiMessage.trim()) {
          messageText = apiMessage;
        }
      }
      setSendError(messageText);
    }
  };

  // ========================================
  // LOAD CONVERSATION + MESSAGES
  // ========================================

  useEffect(() => {
    clearTypingTimeout();

    if (activeTypingConvIdRef.current != null) {
      emitStopTyping(activeTypingConvIdRef.current);
    }

    if (!conversationId || Number.isNaN(conversationId)) {
      return;
    }

    let cancelled = false;

    const loadChat = async () => {
      try {
        setLoading(true);
        setPage(1);
        setHasMore(true);
        setLoadingOlder(false);
        isInitialLoadRef.current = true;

        const [conversationData, messagesRes] = await Promise.all([
          getConversationDetails(conversationId),
          getMessages(conversationId, 1, 20),
        ]);

        if (cancelled) return;

        setConversation(conversationData);
        setMessages(
          Array.isArray(messagesRes?.messages) ? messagesRes.messages : []
        );
        setHasMore(Boolean(messagesRes?.hasMore));
        setPage(1);
        setSelectedFile(null);
        setContent("");
        setSendError(null);
        setTypingUserIds([]);

        try {
          await markConversationAsRead(conversationId);
        } catch (err) {
          console.error("Failed to mark conversation read on load:", err);
        }
      } catch (error) {
        if (cancelled) return;

        console.error("Load chat error:", error);

        setConversation(null);
        setMessages([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadChat();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // ========================================
  // SOCKET LISTENERS & REALTIME STATUS UPDATES
  // ========================================

  useEffect(() => {
    const token = getToken();

    if (!token) {
      console.warn("Socket: No authentication token found");
      return;
    }

    const socket = connectSocket(token);
    socketRef.current = socket;

    const handleConnect = () => {
      console.log("SOCKET CONNECTED:", socket.id);
      if (conversationId && !Number.isNaN(conversationId)) {
        socket.emit("join_conversation", { conversationId });
        socket.emit("message_read", { conversationId });
      }
    };

    const handleDisconnect = () => {
      console.log("SOCKET DISCONNECTED");
      setTypingUserIds([]);
      clearTypingTimeout();
      activeTypingConvIdRef.current = null;
    };

    const handleUserTyping = (data: TypingEvent) => {
      if (
        !conversationId ||
        Number.isNaN(conversationId) ||
        Number(data.conversationId) !== Number(conversationId)
      ) {
        return;
      }

      if (
        currentUserRef.current?.id != null &&
        Number(data.userId) === Number(currentUserRef.current.id)
      ) {
        return;
      }

      setTypingUserIds((prev) =>
        prev.includes(data.userId) ? prev : [...prev, data.userId]
      );
    };

    const handleUserStopTyping = (data: TypingEvent) => {
      if (
        !conversationId ||
        Number.isNaN(conversationId) ||
        Number(data.conversationId) !== Number(conversationId)
      ) {
        return;
      }

      if (
        currentUserRef.current?.id != null &&
        Number(data.userId) === Number(currentUserRef.current.id)
      ) {
        return;
      }

      setTypingUserIds((prev) => prev.filter((id) => id !== data.userId));
    };

    const handleNewMessage = (newMessage: Message) => {
      if (
        !conversationId ||
        Number.isNaN(conversationId) ||
        Number(newMessage.conversationId) !== Number(conversationId)
      ) {
        return;
      }

      const isMine =
        Number(newMessage.senderId) === Number(currentUserRef.current?.id);

      setMessages((previousMessages) => {
        const exists = previousMessages.some(
          (item) => Number(item.id) === Number(newMessage.id)
        );

        if (exists) {
          return previousMessages;
        }

        return [...previousMessages, newMessage];
      });

      const container = messageContainerRef.current;
      const isNearBottom =
        container &&
        container.scrollTop + container.clientHeight >=
          container.scrollHeight - 200;

      if (isMine || isNearBottom) {
        requestAnimationFrame(() => {
          scrollToBottom(true);
        });
      }

      if (!isMine) {
        setTypingUserIds((prev) => prev.filter((id) => id !== newMessage.senderId));

        socket.emit("message_delivered", {
          messageId: newMessage.id,
          conversationId: newMessage.conversationId,
        });

        socket.emit("message_read", {
          messageId: newMessage.id,
          conversationId: newMessage.conversationId,
        });
      }
    };

    const handleMessageUpdated = (payload: { message?: Message } | Message) => {
      const updatedMessage =
        "message" in payload && payload.message
          ? payload.message
          : (payload as Message);

      if (
        !conversationId ||
        Number.isNaN(conversationId) ||
        Number(updatedMessage.conversationId) !== Number(conversationId)
      ) {
        return;
      }

      setMessages((previousMessages) =>
        previousMessages.map((msg) => {
          if (Number(msg.id) === Number(updatedMessage.id)) {
            return {
              ...msg,
              ...updatedMessage,
            };
          }
          if (msg.replyToMessage?.id === updatedMessage.id) {
            return {
              ...msg,
              replyToMessage: {
                ...msg.replyToMessage,
                content: updatedMessage.content,
              },
            };
          }
          return msg;
        })
      );
    };

    const handleMessageDeleted = (data: {
      messageId: number;
      conversationId: number;
      deleteType?: string;
      message?: Message;
    }) => {
      if (
        !conversationId ||
        Number.isNaN(conversationId) ||
        Number(data.conversationId) !== Number(conversationId)
      ) {
        return;
      }

      setMessages((previousMessages) =>
        previousMessages.map((message) => {
          if (Number(message.id) !== Number(data.messageId)) {
            return message;
          }

          const nextMessage = {
            ...message,
            ...(data.message ?? {}),
            isDeleted: true,
            deletedAt: data.message?.deletedAt ?? new Date().toISOString(),
            content: null,
            attachmentUrl: null,
            attachmentName: null,
            attachmentType: null,
            attachmentSize: null,
          };

          return nextMessage;
        })
      );
    };

    const handleDeliveryUpdate = (data: DeliveryUpdate) => {
      if (
        !conversationId ||
        Number.isNaN(conversationId) ||
        Number(data.conversationId) !== Number(conversationId)
      ) {
        return;
      }

      setMessages((previousMessages) =>
        previousMessages.map((msg) =>
          Number(msg.id) === Number(data.messageId)
            ? { ...msg, isDelivered: true }
            : msg
        )
      );
    };

    const handleReadUpdate = (data: ReadUpdate) => {
      if (
        !conversationId ||
        Number.isNaN(conversationId) ||
        Number(data.conversationId) !== Number(conversationId)
      ) {
        return;
      }

      setMessages((previousMessages) =>
        previousMessages.map((msg) =>
          Number(msg.id) === Number(data.messageId)
            ? { ...msg, isDelivered: true, isRead: data.isRead }
            : msg
        )
      );
    };

    const handleReactionUpdated = (data: {
      messageId: number;
      conversationId: number;
      reactions: MessageReaction[];
      userId: number;
      reaction: string | null;
      action: "added" | "updated" | "removed";
    }) => {
      if (
        !conversationId ||
        Number.isNaN(conversationId) ||
        Number(data.conversationId) !== Number(conversationId)
      ) {
        return;
      }

      setMessages((previousMessages) =>
        previousMessages.map((msg) => {
          if (Number(msg.id) === Number(data.messageId)) {
            let updatedMyReaction = msg.myReaction;

            if (
              currentUserRef.current?.id != null &&
              Number(data.userId) === Number(currentUserRef.current.id)
            ) {
              updatedMyReaction =
                data.action === "removed" ? null : data.reaction;
            }

            return {
              ...msg,
              reactions: data.reactions,
              myReaction: updatedMyReaction,
            };
          }
          return msg;
        })
      );
    };

    const handleGroupUpdated = (data: Partial<Conversation> & { conversationId: number }) => {
      if (Number(data.conversationId) === Number(conversationId)) {
        setConversation((prev) =>
          prev
            ? {
                ...prev,
                name: data.name ?? prev.name,
                avatar: data.avatar !== undefined ? data.avatar : prev.avatar,
              }
            : prev
        );
      }
    };

    const handleGroupMemberAdded = (data: { conversationId: number; memberCount?: number; members?: GroupMember[] }) => {
      if (Number(data.conversationId) === Number(conversationId)) {
        setConversation((prev) =>
          prev
            ? {
                ...prev,
                memberCount: data.memberCount ?? (data.members ? data.members.length : prev.memberCount),
                members: data.members ?? prev.members,
              }
            : prev
        );
      }
    };

    const handleGroupMemberRemoved = (data: { conversationId: number; memberCount?: number; members?: GroupMember[]; removedUserId?: number }) => {
      if (Number(data.conversationId) === Number(conversationId)) {
        if (data.removedUserId && Number(data.removedUserId) === Number(currentUserRef.current?.id)) {
          router.push("/chat");
          return;
        }
        setConversation((prev) =>
          prev
            ? {
                ...prev,
                memberCount: data.memberCount ?? (data.members ? data.members.length : prev.memberCount),
                members: data.members ?? prev.members,
              }
            : prev
        );
      }
    };

    const handleGroupMemberLeft = (data: { conversationId: number; memberCount?: number; members?: GroupMember[]; leftUserId?: number }) => {
      if (Number(data.conversationId) === Number(conversationId)) {
        if (data.leftUserId && Number(data.leftUserId) === Number(currentUserRef.current?.id)) {
          router.push("/chat");
          return;
        }
        setConversation((prev) =>
          prev
            ? {
                ...prev,
                memberCount: data.memberCount ?? (data.members ? data.members.length : prev.memberCount),
                members: data.members ?? prev.members,
              }
            : prev
        );
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("new_message", handleNewMessage);
    socket.on("message_updated", handleMessageUpdated);
    socket.on("message_reaction_updated", handleReactionUpdated);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("message_delivery_updated", handleDeliveryUpdate);
    socket.on("message_read_updated", handleReadUpdate);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stop_typing", handleUserStopTyping);

    socket.on("group_updated", handleGroupUpdated);
    socket.on("group_member_added", handleGroupMemberAdded);
    socket.on("group_member_removed", handleGroupMemberRemoved);
    socket.on("group_member_left", handleGroupMemberLeft);

    if (socket.connected && conversationId && !Number.isNaN(conversationId)) {
      socket.emit("join_conversation", { conversationId });
      socket.emit("message_read", { conversationId });
    }

    return () => {
      if (activeTypingConvIdRef.current != null && socket.connected) {
        socket.emit("stop_typing", activeTypingConvIdRef.current);
        activeTypingConvIdRef.current = null;
      }

      if (conversationId && !Number.isNaN(conversationId)) {
        socket.emit("leave_conversation", { conversationId });
      }

      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("new_message", handleNewMessage);
      socket.off("message_updated", handleMessageUpdated);
      socket.off("message_reaction_updated", handleReactionUpdated);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("message_delivery_updated", handleDeliveryUpdate);
      socket.off("message_read_updated", handleReadUpdate);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stop_typing", handleUserStopTyping);

      socket.off("group_updated", handleGroupUpdated);
      socket.off("group_member_added", handleGroupMemberAdded);
      socket.off("group_member_removed", handleGroupMemberRemoved);
      socket.off("group_member_left", handleGroupMemberLeft);

      setTypingUserIds([]);
      clearTypingTimeout();
    };
  }, [conversationId, router]);

  // ========================================
  // SCROLL & PAGINATION HELPERS
  // ========================================

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    } else if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop =
        messageContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (isInitialLoadRef.current && messages.length > 0 && !loading) {
      isInitialLoadRef.current = false;
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    }
  }, [messages, loading]);

  const loadOlderMessages = async () => {
    if (!conversationId || loadingOlder || !hasMore || loading) return;

    const container = messageContainerRef.current;
    if (!container) return;

    const oldScrollTop = container.scrollTop;
    const oldScrollHeight = container.scrollHeight;

    try {
      setLoadingOlder(true);
      const nextPage = page + 1;
      const response = await getMessages(conversationId, nextPage, 20);

      if (!response || !Array.isArray(response.messages)) {
        return;
      }

      const olderMessages = response.messages;

      if (olderMessages.length > 0) {
        setMessages((prevMessages) => {
          const existingIds = new Set(prevMessages.map((m) => m.id));
          const uniqueOlder = olderMessages.filter(
            (m) => !existingIds.has(m.id)
          );
          return [...uniqueOlder, ...prevMessages];
        });
        setPage(nextPage);
      }

      setHasMore(Boolean(response.hasMore));

      requestAnimationFrame(() => {
        if (messageContainerRef.current) {
          const newScrollHeight = messageContainerRef.current.scrollHeight;
          const heightDiff = newScrollHeight - oldScrollHeight;
          messageContainerRef.current.scrollTop = oldScrollTop + heightDiff;
        }
      });
    } catch (error) {
      console.error("Error loading older messages:", error);
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleScroll = () => {
    const container = messageContainerRef.current;
    if (!container) return;

    if (
      container.scrollTop < 80 &&
      hasMore &&
      !loadingOlder &&
      !loading
    ) {
      void loadOlderMessages();
    }
  };

  // ========================================
  // FILE PICKER
  // ========================================

  const handleAttachClick = () => {
    if (sending || Boolean(editingMessageId)) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file) return;

    const validationError = validateAttachmentFile(file);
    if (validationError) {
      setSendError(validationError);
      return;
    }

    setSendError(null);
    setSelectedFile(file);
  };

  const handleRemoveAttachment = () => {
    setSelectedFile(null);
    setSendError(null);
  };

  // ========================================
  // INPUT ONCHANGE & TYPING LOGIC
  // ========================================

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newContent = event.target.value;
    setContent(newContent);

    if (!conversationId || Number.isNaN(conversationId)) return;

    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    clearTypingTimeout();

    if (newContent.trim().length > 0) {
      activeTypingConvIdRef.current = conversationId;
      socket.emit("typing", conversationId);

      typingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current?.connected) {
          socketRef.current.emit("stop_typing", conversationId);
        }
        typingTimeoutRef.current = null;
        activeTypingConvIdRef.current = null;
      }, 1000);
    } else {
      socket.emit("stop_typing", conversationId);
      activeTypingConvIdRef.current = null;
    }
  };

  // ========================================
  // SEND / SAVE MESSAGE
  // ========================================

  const handleSendMessage = async () => {
    const text = content.trim();

    if (!conversationId || Number.isNaN(conversationId)) return;
    if (sending) return;

    if (!isGroup && blockStatus.isBlocked) {
      setSendError("Messaging is blocked with this user.");
      return;
    }

    emitStopTyping(conversationId);
    clearTypingTimeout();

    // EDIT MODE
    if (editingMessageId) {
      if (!text) {
        setSendError("Message content cannot be empty");
        return;
      }

      try {
        setSending(true);
        setSendError(null);

        const response = await editMessage(editingMessageId, text);

        if (!response?.success || !response?.message) {
          throw new Error("Edit message API returned invalid response");
        }

        const updatedMessage = response.message;

        setMessages((previousMessages) =>
          previousMessages.map((msg) => {
            if (Number(msg.id) === Number(updatedMessage.id)) {
              return {
                ...msg,
                ...updatedMessage,
              };
            }
            if (msg.replyToMessage?.id === updatedMessage.id) {
              return {
                ...msg,
                replyToMessage: {
                  ...msg.replyToMessage,
                  content: updatedMessage.content,
                },
              };
            }
            return msg;
          })
        );

        setContent("");
        setEditingMessageId(null);
        setEditingOriginalMessage(null);
      } catch (error) {
        console.error("EDIT MESSAGE API ERROR:", error);
        let message = "Failed to edit message. Please try again.";

        if (axios.isAxiosError(error)) {
          const apiMessage = error.response?.data?.message;
          if (typeof apiMessage === "string" && apiMessage.trim()) {
            message = apiMessage;
          }
        } else if (error instanceof Error && error.message) {
          message = error.message;
        }

        setSendError(message);
      } finally {
        setSending(false);
      }

      return;
    }

    // NORMAL SEND MESSAGE MODE
    if (!text && !selectedFile) return;

    if (selectedFile) {
      const validationError = validateAttachmentFile(selectedFile);
      if (validationError) {
        setSendError(validationError);
        return;
      }
    }

    try {
      setSending(true);
      setSendError(null);

      const response = await sendMessage(
        conversationId,
        text || undefined,
        selectedFile,
        replyingTo?.id
      );

      if (!response?.success || !response?.message) {
        throw new Error("Message API returned invalid response");
      }

      const newMessage = response.message;

      setMessages((previousMessages) => {
        const exists = previousMessages.some(
          (message) => Number(message.id) === Number(newMessage.id)
        );

        if (exists) {
          return previousMessages;
        }

        return [...previousMessages, newMessage];
      });

      setContent("");
      setSelectedFile(null);
      setReplyingTo(null);
      setTypingUserIds([]);

      requestAnimationFrame(() => {
        scrollToBottom(true);
      });
    } catch (error) {
      console.error("MESSAGE API ERROR:", error);

      let message = "Failed to send message. Please try again.";

      if (axios.isAxiosError(error)) {
        const apiMessage = error.response?.data?.message;
        if (typeof apiMessage === "string" && apiMessage.trim()) {
          message = apiMessage;
        } else if (error.message === "Network Error") {
          message = "Network error. Check your connection and retry.";
        }
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }

      setSendError(message);
    } finally {
      setSending(false);
    }
  };

  // ========================================
  // SEARCH HANDLERS
  // ========================================

  const handleResetSearch = () => {
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearching(false);
    setHighlightedMessageId(null);
  };

  const handleSearchMessages = async () => {
    const query = searchQuery.trim();

    if (!conversationId || Number.isNaN(conversationId)) {
      return;
    }

    if (!query) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const results = await searchMessages(conversationId, query);
      setSearchResults(results || []);
    } catch (error) {
      console.error("Message search error:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchResultClick = (messageId: number) => {
    const exists = messages.some((m) => Number(m.id) === Number(messageId));
    if (!exists) {
      const foundInSearch = searchResults.find(
        (m) => Number(m.id) === Number(messageId)
      );
      if (foundInSearch) {
        setMessages((prev) => {
          const updated = [...prev, foundInSearch];
          return updated.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()
          );
        });
      }
    }

    setTimeout(() => {
      const element = document.getElementById(`message-${messageId}`);
      if (!element) return;

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      setHighlightedMessageId(messageId);

      setTimeout(() => {
        setHighlightedMessageId((prev) => (prev === messageId ? null : prev));
      }, 1500);
    }, 50);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (editingMessageId) {
        handleCancelEdit();
      } else if (replyingTo) {
        setReplyingTo(null);
      }
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const renderMessageStatus = (message: Message, isMine: boolean) => {
    if (!isMine) return null;

    if (message.isRead) {
      return (
        <span
          className="ml-1.5 inline-flex items-center text-[12px] font-bold text-sky-300"
          title="Read"
        >
          ✓✓
        </span>
      );
    }

    if (message.isDelivered) {
      return (
        <span
          className="ml-1.5 inline-flex items-center text-[12px] font-medium text-gray-300"
          title="Delivered"
        >
          ✓✓
        </span>
      );
    }

    return (
      <span
        className="ml-1.5 inline-flex items-center text-[12px] font-medium text-gray-300"
        title="Sent"
      >
        ✓
      </span>
    );
  };

  // Helper for typing text
  const getTypingText = () => {
    if (typingUserIds.length === 0) return null;
    if (isGroup) {
      const members = conversation?.members || [];
      const typingNames = typingUserIds.map((id) => {
        const found = members.find((m) => Number(m.id) === Number(id));
        return found ? found.name : "Member";
      });

      if (typingNames.length === 1) {
        return `${typingNames[0]} is typing...`;
      } else if (typingNames.length === 2) {
        return `${typingNames[0]} and ${typingNames[1]} are typing...`;
      } else {
        return `${typingNames[0]} and ${typingNames.length - 1} others are typing...`;
      }
    } else {
      return "typing...";
    }
  };

  if (!conversationIdParam) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50/50 p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm border border-blue-100/50">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-800">
            No conversation selected
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Select a chat to start messaging
          </p>
        </div>
      </div>
    );
  }

  if (!conversationId || Number.isNaN(conversationId)) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white">
        <p className="text-sm text-red-500">Invalid conversation</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white">
        <p className="text-sm text-gray-500">Loading messages...</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white">
        <p className="text-sm text-red-500">Unable to load conversation</p>
      </div>
    );
  }

  const otherUser = conversation.otherUser;
  const canSend =
    editingMessageId
      ? Boolean(content.trim()) && !sending
      : Boolean(content.trim() || selectedFile) && !sending;

  const typingText = getTypingText();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white">
      {/* Group Info Modal */}
      {conversation && isGroup && (
        <GroupInfoModal
          isOpen={isGroupInfoOpen}
          onClose={() => setIsGroupInfoOpen(false)}
          conversation={conversation}
          onGroupUpdated={(updated) => setConversation(updated)}
          onLeftGroup={() => router.push("/chat")}
        />
      )}

      {/* CHAT HEADER */}
      <div className="flex shrink-0 items-center justify-between border-b px-5 py-3 bg-white">
        <div
          className={`flex items-center gap-3 min-w-0 ${isGroup ? "cursor-pointer hover:opacity-80 transition" : ""}`}
          onClick={() => {
            if (isGroup) setIsGroupInfoOpen(true);
          }}
        >
          {isGroup ? (
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 font-bold text-indigo-600 border border-indigo-200 shadow-sm">
              {conversation.avatar ? (
                <img
                  src={getAttachmentUrl(conversation.avatar)}
                  alt={conversation.name || "Group"}
                  className="h-full w-full object-cover"
                />
              ) : (
                (conversation.name || "G").charAt(0).toUpperCase()
              )}
            </div>
          ) : (
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-semibold text-blue-600">
              {otherUser?.avatar ? (
                <img
                  src={getAttachmentUrl(otherUser.avatar)}
                  alt={otherUser.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                otherUser?.name ? otherUser.name.charAt(0).toUpperCase() : "?"
              )}

              {otherUser?.isOnline && (
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
              )}
            </div>
          )}

          <div className="min-w-0">
            <h2 className="truncate font-semibold text-gray-800 flex items-center gap-1.5">
              {isGroup ? conversation.name || "Group Chat" : otherUser?.name}
            </h2>

            <p className="text-xs text-gray-500">
              {typingText ? (
                <span className="text-blue-500 font-medium">{typingText}</span>
              ) : isGroup ? (
                `${conversation.memberCount || conversation.members?.length || 0} members`
              ) : otherUser?.isOnline ? (
                "Online"
              ) : (
                "Offline"
              )}
            </p>
          </div>
        </div>

        {/* HEADER ACTION BUTTONS */}
        <div className="relative flex items-center gap-2 shrink-0">
          {isGroup && (
            <button
              type="button"
              onClick={() => setIsGroupInfoOpen(true)}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition flex items-center gap-1"
              title="Group Info"
            >
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Info</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (showSearch) {
                handleResetSearch();
              } else {
                setShowSearch(true);
              }
            }}
            className={`rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition ${
              showSearch ? "bg-blue-50 text-blue-600" : ""
            }`}
            title="Search messages"
            aria-label="Search messages"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setShowBlockMenu((prev) => !prev)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition font-bold"
            title="More options"
            aria-label="More options"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {showBlockMenu && (
            <div className="absolute right-0 top-11 z-40 w-52 rounded-xl border border-gray-100 bg-white py-1.5 shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150 divide-y divide-gray-100">
              <div className="py-0.5">
                {isGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowBlockMenu(false);
                      setIsGroupInfoOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Group Info</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowBlockMenu(false);
                    setShowSearch(true);
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Search Messages</span>
                </button>

                {!isGroup && (
                  blockStatus.blockedByUser ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowBlockMenu(false);
                        setBlockConfirmDialog("unblock");
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition"
                    >
                      <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Unblock User</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowBlockMenu(false);
                        setBlockConfirmDialog("block");
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                    >
                      <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <span>Block User</span>
                    </button>
                  )
                )}
              </div>

              <div className="py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowBlockMenu(false);
                    setShowDeleteConvModal(true);
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete Chat</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DELETE CONVERSATION CONFIRMATION DIALOG */}
      {showDeleteConvModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setShowDeleteConvModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl transition-all border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900">
                Delete conversation?
              </h3>
            </div>
            <p className="mt-3 text-xs text-gray-500 leading-relaxed">
              This will remove this chat from your list. Messages will not be deleted for others.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConvModal(false)}
                disabled={deleteConvLoading}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteConversation}
                disabled={deleteConvLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition"
              >
                {deleteConvLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK CONFIRMATION DIALOG */}
      {blockConfirmDialog === "block" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl transition-all">
            <h3 className="text-base font-bold text-gray-900">Block this user?</h3>
            <p className="mt-2 text-xs text-gray-500">
              Blocked users can&apos;t send messages to you or receive messages from you.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setBlockConfirmDialog(null)}
                disabled={blockActionLoading}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                disabled={blockActionLoading}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                {blockActionLoading ? "Blocking..." : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNBLOCK CONFIRMATION DIALOG */}
      {blockConfirmDialog === "unblock" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl transition-all">
            <h3 className="text-base font-bold text-gray-900">Unblock this user?</h3>
            <p className="mt-2 text-xs text-gray-500">
              They will be able to send you messages and interact with you again.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setBlockConfirmDialog(null)}
                disabled={blockActionLoading}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUnblock}
                disabled={blockActionLoading}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {blockActionLoading ? "Unblocking..." : "Unblock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEARCH PANEL BAR */}
      {showSearch && (
        <div className="shrink-0 border-b bg-gray-50/90 p-3 backdrop-blur-sm transition">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  const val = event.target.value;
                  setSearchQuery(val);
                  if (!val.trim()) {
                    setSearchResults([]);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearchMessages();
                  if (event.key === "Escape") handleResetSearch();
                }}
                placeholder="Search messages..."
                autoFocus
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleSearchMessages}
              disabled={searching || !searchQuery.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition shrink-0"
            >
              {searching ? "Searching..." : "Search"}
            </button>

            <button
              type="button"
              onClick={handleResetSearch}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition shrink-0"
            >
              ✕
            </button>
          </div>

          {!searching && searchQuery.trim() !== "" && searchResults.length > 0 && (
            <div className="mt-2.5 max-h-60 overflow-y-auto rounded-lg border bg-white shadow-sm divide-y">
              <div className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500 flex justify-between items-center">
                <span>Search results</span>
                <span>{searchResults.length} message(s) found</span>
              </div>
              {searchResults.map((message) => {
                const senderDisplayName = getSenderName(
                  message.senderId,
                  currentUser?.id,
                  message.senderName || otherUser?.name,
                  conversation.members
                );
                const timeStr = new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => handleSearchResultClick(message.id)}
                    className="block w-full px-3 py-2 text-left hover:bg-blue-50/60 transition group"
                  >
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-0.5">
                      <span className="font-semibold text-gray-700">
                        {senderDisplayName}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {timeStr}
                      </span>
                    </div>
                    <p className="truncate text-sm text-gray-800">
                      {message.content || (message.attachmentName ? `📎 ${message.attachmentName}` : "Attachment")}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MESSAGES CONTAINER */}
      <div
        ref={messageContainerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5"
      >
        {loadingOlder && (
          <div className="mb-3 flex shrink-0 items-center justify-center">
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm backdrop-blur-sm">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span>Loading older messages...</span>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">No messages yet</p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            {messages.map((message, index) => {
              // Handle System Messages
              if (message.type === "SYSTEM") {
                return (
                  <div key={message.id} className="my-2 flex justify-center w-full">
                    <span className="rounded-full bg-gray-100 px-3.5 py-1 text-[11px] font-medium text-gray-500 border border-gray-200/60 shadow-2xs">
                      {message.content}
                    </span>
                  </div>
                );
              }

              const isMine = Number(message.senderId) === Number(currentUser?.id);
              const isHighlighted = highlightedMessageId === message.id;
              const isDeletedMessage = Boolean(message.isDeleted);

              // Check if previous message was from same sender
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const showSenderHeader =
                isGroup &&
                !isMine &&
                (!prevMsg ||
                  prevMsg.type === "SYSTEM" ||
                  Number(prevMsg.senderId) !== Number(message.senderId));

              const senderDisplayName = getSenderName(
                message.senderId,
                currentUser?.id,
                message.senderName || otherUser?.name,
                conversation.members
              );

              return (
                <div
                  id={`message-${message.id}`}
                  key={message.id}
                  className={`group relative flex w-full items-center gap-1.5 rounded-lg transition-colors duration-500 ${
                    isHighlighted
                      ? "bg-amber-100/80 p-1 ring-2 ring-amber-400"
                      : ""
                  } ${isMine ? "justify-end" : "justify-start"}`}
                >
                  {!isDeletedMessage && isMine && (
                    <div className="relative flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition shrink-0">
                      {!message.isDeleted && Boolean(message.content) && (
                        <button
                          type="button"
                          onClick={() => handleStartEditMessage(message)}
                          className="rounded p-1 text-xs text-gray-400 hover:text-amber-600 transition"
                          title="Edit message"
                        >
                          ✏️
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setReactionPickerMessageId((prev) =>
                            prev === message.id ? null : message.id
                          )
                        }
                        className="rounded p-1 text-xs text-gray-400 hover:text-amber-500 transition"
                        title="React"
                      >
                        🙂
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(message)}
                        className="rounded p-1 text-xs text-gray-400 hover:text-blue-600 transition"
                        title="Reply"
                      >
                        ↩
                      </button>
                      <button
                        type="button"
                        onClick={() => setMessageMenuId(message.id)}
                        className="rounded p-1 text-xs text-gray-400 hover:text-gray-700 transition"
                        title="Message options"
                      >
                        ⋯
                      </button>
                    </div>
                  )}

                  <div className={`relative flex flex-col max-w-[75%] sm:max-w-[70%] ${isMine ? "items-end" : "items-start"}`}>
                    {/* Sender Name for Group incoming messages */}
                    {showSenderHeader && (
                      <span className="mb-0.5 pl-1 text-[11px] font-bold text-blue-600">
                        {senderDisplayName}
                      </span>
                    )}

                    {reactionPickerMessageId === message.id && !isDeletedMessage && (
                      <ReactionPicker
                        onSelectReaction={(emoji) =>
                          handleToggleReaction(message.id, emoji)
                        }
                        onClose={() => setReactionPickerMessageId(null)}
                        currentReaction={message.myReaction}
                        isMine={isMine}
                      />
                    )}

                    <div
                      className={`w-fit max-w-full overflow-hidden rounded-2xl px-3.5 py-2 transition-all ${
                        highlightedMessageId === message.id
                          ? "ring-4 ring-yellow-300"
                          : ""
                      } ${
                        isMine
                          ? "rounded-br-md bg-blue-600 text-white"
                          : "rounded-bl-md bg-gray-100 text-gray-800"
                      }`}
                    >
                      {message.replyToMessage && (
                        <div
                          onClick={() =>
                            handleScrollToMessage(message.replyToMessage!.id)
                          }
                          className={`mb-1.5 cursor-pointer rounded-lg border-l-4 px-2.5 py-1 text-xs transition ${
                            isDeletedMessage
                              ? "border-gray-300 bg-gray-200 text-gray-600"
                              : isMine
                              ? "border-white/80 bg-blue-700/70 text-white hover:bg-blue-700"
                              : "border-blue-500 bg-gray-200/80 text-gray-800 hover:bg-gray-200"
                          }`}
                          title="Click to view original message"
                        >
                          <div className="font-semibold opacity-90">
                            {message.replyToMessage.senderName ||
                              getSenderName(
                                message.replyToMessage.senderId,
                                currentUser?.id,
                                otherUser?.name,
                                conversation.members
                              )}
                          </div>
                          <div className="truncate opacity-80">
                            {getReplyPreviewLabel(message.replyToMessage)}
                          </div>
                        </div>
                      )}

                      {!isDeletedMessage && message.attachmentUrl && (
                        <AttachmentMessage
                          message={message}
                          isMine={isMine}
                        />
                      )}

                      {isDeletedMessage ? (
                        <p className="text-sm whitespace-pre-wrap">This message was deleted</p>
                      ) : message.content ? (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      ) : null}

                      {!isDeletedMessage && (
                        <div
                          className={`mt-1 flex items-center justify-end text-[10px] ${
                            isMine ? "text-blue-100" : "text-gray-400"
                          }`}
                        >
                          <span>
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {message.isEdited && (
                            <span
                              className={`ml-1 font-normal italic ${
                                isMine ? "text-blue-200" : "text-gray-400"
                              }`}
                            >
                              · edited
                            </span>
                          )}

                          {renderMessageStatus(message, isMine)}
                        </div>
                      )}
                    </div>

                    {message.reactions && message.reactions.length > 0 && !isDeletedMessage && (
                      <div
                        className={`mt-1 flex w-full flex-wrap gap-1 ${
                          isMine ? "justify-end" : "justify-start"
                        }`}
                      >
                        {message.reactions.map((rGroup) => {
                          const isMyReactionGroup =
                            message.myReaction === rGroup.reaction;
                          const userNamesList = (rGroup.users || [])
                            .map((u) => (typeof u === "object" ? u.name : `User ${u}`))
                            .join(", ");

                          return (
                            <div key={rGroup.reaction} className="relative group/pill">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleToggleReaction(
                                    message.id,
                                    rGroup.reaction
                                  );
                                }}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition cursor-pointer select-none ${
                                  isMyReactionGroup
                                    ? "border-blue-300 bg-blue-50 text-blue-700 shadow-sm font-semibold ring-1 ring-blue-200"
                                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                }`}
                              >
                                <span>{rGroup.reaction}</span>
                                <span className="text-[11px] font-semibold">
                                  {rGroup.count}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {!isMine && !isDeletedMessage && (
                    <div className="relative flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setReactionPickerMessageId((prev) =>
                            prev === message.id ? null : message.id
                          )
                        }
                        className="rounded p-1 text-xs text-gray-400 hover:text-amber-500 transition"
                        title="React"
                      >
                        🙂
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(message)}
                        className="rounded p-1 text-xs text-gray-400 hover:text-blue-600 transition"
                        title="Reply"
                      >
                        ↩
                      </button>
                    </div>
                  )}

                  {messageMenuId === message.id && !isDeletedMessage && (
                    <div className="absolute right-0 top-0 z-20 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(message);
                          setMessageMenuId(null);
                        }}
                        className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmMessageId(message.id);
                          setMessageMenuId(null);
                        }}
                        className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Delete
                      </button>
                      {isMine && (
                        <button
                          type="button"
                          onClick={() => {
                            handleStartEditMessage(message);
                            setMessageMenuId(null);
                          }}
                          className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}

                  {deleteConfirmMessageId === message.id && !isDeletedMessage && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/10 backdrop-blur-[1px]">
                      <div className="w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
                        <p className="text-sm font-medium text-gray-800">
                          {isMine
                            ? "Delete message?"
                            : "Delete this message for you?"}
                        </p>
                        <div className="mt-3 space-y-2">
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmMessageId(null)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleDeleteMessage(message, "me");
                            }}
                            className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-900"
                          >
                            Delete for Me
                          </button>
                          {isMine && (
                            <button
                              type="button"
                              onClick={() => {
                                void handleDeleteMessage(message, "everyone");
                              }}
                              className="w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                            >
                              Delete for Everyone
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* MESSAGE INPUT / COMPOSER AREA */}
      <div className="shrink-0 border-t bg-white p-4">
        {!isGroup && blockStatus.isBlocked ? (
          <div className="flex items-center justify-between rounded-xl bg-gray-100 p-3.5 border border-gray-200">
            {blockStatus.blockedByUser ? (
              <>
                <span className="text-xs font-medium text-gray-700">
                  You blocked this user.
                </span>
                <button
                  type="button"
                  onClick={() => setBlockConfirmDialog("unblock")}
                  className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                >
                  Unblock
                </button>
              </>
            ) : (
              <span className="text-xs font-medium text-gray-500">
                You can&apos;t send messages to this user.
              </span>
            )}
          </div>
        ) : (
          <>
            {editingOriginalMessage && (
              <div className="mb-3 flex items-center justify-between rounded-lg border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-xs transition">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                    <span>✏️ Editing message</span>
                  </div>
                  <p className="truncate text-gray-600">
                    {editingOriginalMessage.content ||
                      getReplyPreviewLabel(editingOriginalMessage)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-amber-100 hover:text-gray-700 transition"
                >
                  ✕
                </button>
              </div>
            )}

            {replyingTo && !editingMessageId && (
              <div className="mb-3 flex items-center justify-between rounded-lg border-l-4 border-blue-600 bg-blue-50 px-3 py-2 text-xs transition">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5 font-semibold text-blue-700">
                    <span>↩ Replying to</span>
                    <span>
                      {getSenderName(
                        replyingTo.senderId,
                        currentUser?.id,
                        replyingTo.senderName || otherUser?.name,
                        conversation.members
                      )}
                    </span>
                  </div>
                  <p className="truncate text-gray-600">
                    {getReplyPreviewLabel(replyingTo)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-blue-100 hover:text-gray-700 transition"
                >
                  ✕
                </button>
              </div>
            )}

            {selectedFile && !editingMessageId && (
              <AttachmentPreview
                file={selectedFile}
                onRemove={handleRemoveAttachment}
              />
            )}

            {sendError && (
              <p className="mb-2 text-sm text-red-500">{sendError}</p>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileChange}
                disabled={sending || Boolean(editingMessageId)}
              />

              <button
                type="button"
                onClick={handleAttachClick}
                disabled={sending || Boolean(editingMessageId)}
                title={editingMessageId ? "Attachments disabled while editing" : "Attach file"}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-lg transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                📎
              </button>

              <input
                type="text"
                value={content}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={editingMessageId ? "Edit your message..." : "Type a message..."}
                disabled={sending}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 disabled:bg-gray-100"
              />

              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!canSend || !conversationId}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending
                  ? editingMessageId
                    ? "Saving..."
                    : selectedFile
                    ? "Uploading..."
                    : "Sending..."
                  : editingMessageId
                  ? "Save"
                  : "Send"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* TOAST FEEDBACK NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2.5 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-medium text-white shadow-xl">
            <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatWindow;
