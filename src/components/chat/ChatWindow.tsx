"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";

import { getConversationDetails } from "@/services/conversation.service";
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

import { useAuthStore } from "@/store/auth.store";
import { connectSocket } from "@/lib/socket";
import { getToken } from "@/lib/auth";
import {
  ACCEPTED_FILE_TYPES,
  validateAttachmentFile,
  isDocumentType,
} from "@/lib/file";
import { AttachmentPreview } from "@/components/chat/AttachmentPreview";
import { AttachmentMessage } from "@/components/chat/AttachmentMessage";

interface ConversationDetails {
  id: number;
  otherUser: {
    id: number;
    name: string;
    email: string;
    avatar?: string | null;
    isOnline?: boolean;
    lastSeen?: string | null;
  };
}

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
  otherUserName?: string
): string {
  if (currentUserId && Number(senderId) === Number(currentUserId)) {
    return "You";
  }
  return otherUserName || "User";
}

export function ChatWindow() {
  const searchParams = useSearchParams();
  const conversationIdParam = searchParams.get("conversationId");

  const currentUser = useAuthStore((state) => state.user);

  const [conversation, setConversation] =
    useState<ConversationDetails | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingOriginalMessage, setEditingOriginalMessage] =
    useState<Message | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] =
    useState<number | null>(null);
  const [messageMenuId, setMessageMenuId] = useState<number | null>(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<number | null>(null);
  const [deleteConfirmMessageId, setDeleteConfirmMessageId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);
  const activeTypingConvIdRef = useRef<number | null>(null);
  const currentUserRef = useRef(currentUser);
const [searchQuery, setSearchQuery] = useState("");
const [searchResults, setSearchResults] = useState<Message[]>([]);
const [searching, setSearching] = useState(false);
const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const conversationId = conversationIdParam
    ? Number(conversationIdParam)
    : null;

  // Reset typing UI immediately when switching conversations (render-time adjust)
  const [typingTrackedConversationId, setTypingTrackedConversationId] =
    useState<number | null>(conversationId);

  if (conversationId !== typingTrackedConversationId) {
    setTypingTrackedConversationId(conversationId);
    if (isOtherUserTyping) {
      setIsOtherUserTyping(false);
    }
    setReplyingTo(null);
    setEditingMessageId(null);
    setEditingOriginalMessage(null);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearching(false);
    setHighlightedMessageId(null);
  }

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

      const targetIndex = nextReactions.findIndex(
        (g) => g.reaction === emoji
      );
      const currentUserInfo = currentUser
        ? { id: currentUser.id, name: currentUser.name }
        : { id: 0, name: "You" };

      if (targetIndex >= 0) {
        const group = nextReactions[targetIndex];
        nextReactions[targetIndex] = {
          ...group,
          count: group.count + 1,
          users: [...(group.users || []), currentUserInfo],
        };
      } else {
        nextReactions.push({
          reaction: emoji,
          count: 1,
          users: [currentUserInfo],
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
      if (!response.success) {
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

        const [conversationData, messagesData] = await Promise.all([
          getConversationDetails(conversationId),
          getMessages(conversationId),
        ]);

        if (cancelled) return;

        setConversation(conversationData);
        setMessages(Array.isArray(messagesData) ? messagesData : []);
        setSelectedFile(null);
        setContent("");
        setSendError(null);
        setIsOtherUserTyping(false);

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
        console.log("[RECIPIENT] MESSAGE READ ACK SENT", { conversationId });
      }
    };

    const handleDisconnect = () => {
      console.log("SOCKET DISCONNECTED");
      setIsOtherUserTyping(false);
      clearTypingTimeout();
      activeTypingConvIdRef.current = null;
    };

    const handleUserTyping = (data: TypingEvent) => {
      console.log("[RECIPIENT] USER IS TYPING", data);

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

      setIsOtherUserTyping(true);
    };

    const handleUserStopTyping = (data: TypingEvent) => {
      console.log("[RECIPIENT] USER STOPPED TYPING", data);

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

      setIsOtherUserTyping(false);
    };

    const handleNewMessage = (newMessage: Message) => {
      console.log("DELIVERY DEBUG - NEW MESSAGE:", {
        messageId: newMessage.id,
        conversationId: newMessage.conversationId,
        senderId: newMessage.senderId,
        currentUserId: currentUserRef.current?.id,
      });

      console.log("[RECIPIENT] NEW MESSAGE RECEIVED", newMessage);

      if (
        !conversationId ||
        Number.isNaN(conversationId) ||
        Number(newMessage.conversationId) !== Number(conversationId)
      ) {
        return;
      }

      setMessages((previousMessages) => {
        const exists = previousMessages.some(
          (item) => Number(item.id) === Number(newMessage.id)
        );

        if (exists) {
          return previousMessages;
        }

        return [...previousMessages, newMessage];
      });

      if (
        Number(newMessage.senderId) !== Number(currentUserRef.current?.id)
      ) {
        // Incoming message from the other user ends their typing indicator
        setIsOtherUserTyping(false);

        console.log("DELIVERY DEBUG - SENDING ACK:", {
          messageId: newMessage.id,
          conversationId: newMessage.conversationId,
        });

        socket.emit("message_delivered", {
          messageId: newMessage.id,
          conversationId: newMessage.conversationId,
        });

        console.log("DELIVERY DEBUG - ACK EMITTED");

        socket.emit("message_read", {
          messageId: newMessage.id,
          conversationId: newMessage.conversationId,
        });

        console.log("[RECIPIENT] MESSAGE READ ACK SENT", {
          messageId: newMessage.id,
          conversationId: newMessage.conversationId,
        });
      }
    };

    const handleMessageUpdated = (payload: { message?: Message } | Message) => {
      console.log("[SOCKET] MESSAGE UPDATED RECEIVED:", payload);

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
      console.log("DELIVERY DEBUG - UPDATE RECEIVED BY SENDER:", data);

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
      console.log("[SENDER] MESSAGE READ UPDATED", data);

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
      console.log("[SOCKET] MESSAGE REACTION UPDATED:", data);

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

    if (socket.connected && conversationId && !Number.isNaN(conversationId)) {
      socket.emit("join_conversation", { conversationId });
      socket.emit("message_read", { conversationId });
      console.log("[RECIPIENT] MESSAGE READ ACK SENT", { conversationId });
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

      setIsOtherUserTyping(false);
      clearTypingTimeout();
    };
  }, [conversationId]);

  // ========================================
  // AUTO SCROLL TO LATEST MESSAGE
  // ========================================

  useEffect(() => {
    if (!messagesEndRef.current) return;

    messagesEndRef.current.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, selectedFile]);

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

    // Reuse the existing connected socket — never create a new connection per keystroke
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

        console.log("CALLING EDIT MESSAGE API:", editingMessageId, text);

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

      console.log("1. SEND CLICKED");
      console.log("2. CALLING MESSAGE API WITH REPLY ID:", replyingTo?.id);

      const response = await sendMessage(
        conversationId,
        text || undefined,
        selectedFile,
        replyingTo?.id
      );

      console.log("3. MESSAGE API RESPONSE:", response);

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
      setIsOtherUserTyping(false);
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
      if (!element) {
        return;
      }

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

  // ========================================
  // KEYBOARD HANDLER
  // ========================================

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

  // ========================================
  // MESSAGE STATUS ICON RENDERER
  // ========================================

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

  // ========================================
  // NO CONVERSATION SELECTED
  // ========================================

  if (!conversationIdParam) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800">
            Select a conversation
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Choose a user from the sidebar to start chatting
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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white">
      {/* CHAT HEADER */}
      <div className="flex shrink-0 items-center justify-between border-b px-5 py-3 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-semibold text-blue-600">
            {otherUser.avatar ? (
              <img
                src={otherUser.avatar}
                alt={otherUser.name}
                className="h-full w-full object-cover"
              />
            ) : (
              otherUser.name.charAt(0).toUpperCase()
            )}

            {otherUser.isOnline && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
            )}
          </div>

          <div className="min-w-0">
            <h2 className="truncate font-semibold text-gray-800">
              {otherUser.name}
            </h2>

            <p className="text-xs text-gray-500">
              {isOtherUserTyping ? (
                <span className="text-blue-500">typing...</span>
              ) : otherUser.isOnline ? (
                "Online"
              ) : (
                "Offline"
              )}
            </p>
          </div>
        </div>

        {/* SEARCH TOGGLE BUTTON */}
        <div className="flex items-center gap-2 shrink-0">
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
            🔍
          </button>
        </div>
      </div>

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
                  if (event.key === "Enter") {
                    handleSearchMessages();
                  }

                  if (event.key === "Escape") {
                    handleResetSearch();
                  }
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
                  title="Clear input"
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
              title="Close search"
              aria-label="Close search"
            >
              ✕
            </button>
          </div>

          {searching && (
            <p className="mt-2.5 text-xs text-gray-500 animate-pulse">
              Searching messages...
            </p>
          )}

          {!searching && searchQuery.trim() !== "" && searchResults.length > 0 && (
            <div className="mt-2.5 max-h-60 overflow-y-auto rounded-lg border bg-white shadow-sm divide-y">
              <div className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500 flex justify-between items-center">
                <span>Search results</span>
                <span>
                  {searchResults.length} message
                  {searchResults.length === 1 ? "" : "s"} found
                </span>
              </div>
              {searchResults.map((message) => {
                const senderDisplayName = getSenderName(
                  message.senderId,
                  currentUser?.id,
                  otherUser.name
                );
                const timeStr = new Date(message.createdAt).toLocaleTimeString(
                  [],
                  { hour: "2-digit", minute: "2-digit" }
                );

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

          {!searching && searchQuery.trim() !== "" && searchResults.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              No messages found
            </p>
          )}
        </div>
      )}

      {/* MESSAGES CONTAINER */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">No messages yet</p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            {messages.map((message) => {
              const isMine =
                Number(message.senderId) !== Number(otherUser.id);
              const isHighlighted = highlightedMessageId === message.id;
              const isDeletedMessage = Boolean(message.isDeleted);

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
                          aria-label="Edit message"
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
                        aria-label="Add reaction"
                        title="React"
                      >
                        🙂
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(message)}
                        className="rounded p-1 text-xs text-gray-400 hover:text-blue-600 transition"
                        aria-label="Reply to message"
                        title="Reply"
                      >
                        ↩
                      </button>
                      <button
                        type="button"
                        onClick={() => setMessageMenuId(message.id)}
                        className="rounded p-1 text-xs text-gray-400 hover:text-gray-700 transition"
                        aria-label="Message options"
                        title="Message options"
                      >
                        ⋯
                      </button>
                    </div>
                  )}

                  <div className={`relative flex flex-col max-w-[75%] sm:max-w-[70%] ${isMine ? "items-end" : "items-start"}`}>
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
                                otherUser.name
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
                              title={
                                message.editedAt
                                  ? `Edited ${new Date(
                                      message.editedAt
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}`
                                  : "Edited"
                              }
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
                                aria-label={`Reaction ${rGroup.reaction}, count ${rGroup.count}${
                                  userNamesList
                                    ? `, reacted by ${userNamesList}`
                                    : ""
                                }`}
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

                              {userNamesList && (
                                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/pill:flex flex-col items-center z-30 pointer-events-none">
                                  <div className="rounded-md bg-gray-900/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-medium text-white shadow-lg whitespace-nowrap">
                                    <span className="font-semibold mr-1">
                                      {rGroup.reaction}
                                    </span>
                                    {userNamesList}
                                  </div>
                                  <div className="w-1.5 h-1.5 bg-gray-900/90 rotate-45 -mt-1"></div>
                                </div>
                              )}
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
                        aria-label="Add reaction"
                        title="React"
                      >
                        🙂
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(message)}
                        className="rounded p-1 text-xs text-gray-400 hover:text-blue-600 transition"
                        aria-label="Reply to message"
                        title="Reply"
                      >
                        ↩
                      </button>
                    </div>
                  )}

                  {messageMenuId === message.id && !isDeletedMessage && (
                    <div className="absolute right-0 top-0 z-20 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                      {!isMine ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(message);
                              setMessageMenuId(null);
                            }}
                            className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                            aria-label="Reply to message"
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
                            aria-label="Delete for me"
                          >
                            Delete for Me
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(message);
                              setMessageMenuId(null);
                            }}
                            className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                            aria-label="Reply to message"
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
                            aria-label="Delete message"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleStartEditMessage(message);
                              setMessageMenuId(null);
                            }}
                            className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                            aria-label="Edit message"
                          >
                            Edit
                          </button>
                        </>
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
                            aria-label="Cancel"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleDeleteMessage(message, "me");
                            }}
                            className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-900"
                            aria-label="Delete for me"
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
                              aria-label="Delete for everyone"
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
              aria-label="Cancel edit"
              title="Cancel edit"
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
                    otherUser.name
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
              aria-label="Cancel reply"
              title="Cancel reply"
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
            aria-label={editingMessageId ? "Save edited message" : "Send message"}
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
      </div>
    </div>
  );
}

export default ChatWindow;
