"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getConversationDetails } from "@/services/conversation.service";
import {
  getMessages,
  sendMessage,
  Message,
} from "@/services/message.services";

import { useAuthStore } from "@/store/auth.store";
import { connectSocket } from "@/lib/socket";
import { getToken } from "@/lib/auth";
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

export function ChatWindow() {
  const searchParams = useSearchParams();
  const conversationIdParam = searchParams.get("conversationId");

  const currentUser = useAuthStore((state) => state.user);

  const [conversation, setConversation] =
    useState<ConversationDetails | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Convert conversation ID safely
  const conversationId = conversationIdParam
    ? Number(conversationIdParam)
    : null;

  // ========================================
  // LOAD CONVERSATION + MESSAGES
  // ========================================

  useEffect(() => {
    if (!conversationId || Number.isNaN(conversationId)) {
      setConversation(null);
      setMessages([]);
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
  // AUTO SCROLL TO LATEST MESSAGE
  // ========================================
  useEffect(() => {
    const token = getToken();

    if (!token) {
      console.warn("Socket: No authentication token found");
      return;
    }

    const socket = connectSocket(token);

    const handleConnect = () => {
      console.log("SOCKET CONNECTED:", socket.id);
    };

    const handleDisconnect = () => {
      console.log("SOCKET DISCONNECTED");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);
  useEffect(() => {
    if (!messagesEndRef.current) return;

    messagesEndRef.current.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  // ========================================
  // SEND MESSAGE
  // ========================================

  const handleSendMessage = async () => {
    const text = content.trim();

    if (!text) return;
    if (!conversationId || Number.isNaN(conversationId)) return;
    if (sending) return;

    try {
      setSending(true);

      const response = await sendMessage(conversationId, text);

      console.log("SEND MESSAGE RESPONSE:", response);

      if (!response?.success || !response?.message) {
        console.error("Invalid send message response:", response);
        return;
      }

      const newMessage = response.message;

      // Add new message immediately to UI
      setMessages((previousMessages) => {
        const alreadyExists = previousMessages.some(
          (message) => message.id === newMessage.id
        );

        if (alreadyExists) {
          return previousMessages;
        }

        return [...previousMessages, newMessage];
      });

      // Clear input only after successful message
      setContent("");
    } catch (error) {
      console.error("Send message error:", error);
    } finally {
      setSending(false);
    }
  };

  // ========================================
  // ENTER TO SEND
  // ========================================

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
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

  // ========================================
  // INVALID CONVERSATION ID
  // ========================================

  if (!conversationId || Number.isNaN(conversationId)) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white">
        <p className="text-sm text-red-500">
          Invalid conversation
        </p>
      </div>
    );
  }

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white">
        <p className="text-sm text-gray-500">
          Loading messages...
        </p>
      </div>
    );
  }

  // ========================================
  // CONVERSATION NOT FOUND
  // ========================================

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white">
        <p className="text-sm text-red-500">
          Unable to load conversation
        </p>
      </div>
    );
  }

  const otherUser = conversation.otherUser;

  // ========================================
  // CHAT UI
  // ========================================

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white">

      {/* ================================== */}
      {/* CHAT HEADER */}
      {/* ================================== */}

      <div className="flex shrink-0 items-center gap-3 border-b px-5 py-3">

        {/* Avatar */}
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

          {/* Online Dot */}
          {otherUser.isOnline && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
          )}
        </div>

        {/* User Info */}
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-gray-800">
            {otherUser.name}
          </h2>

          <p className="text-xs text-gray-500">
            {otherUser.isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      {/* ================================== */}
      {/* MESSAGES CONTAINER */}
      {/* ================================== */}

      <div className="min-h-0 flex-1 overflow-y-auto p-5">

        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">
              No messages yet
            </p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            {messages.map((message) => {
              // Other user's messages = LEFT
              // Our messages = RIGHT
              const isMine =
                Number(message.senderId) !== Number(otherUser.id);

              return (
                <div
                  key={message.id}
                  className={`flex w-full ${isMine ? "justify-end" : "justify-start"
                    }`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMine
                      ? "rounded-br-md bg-blue-600 text-white"
                      : "rounded-bl-md bg-gray-100 text-gray-800"
                      }`}
                  >
                    {/* Message */}
                    <p className="break-words text-sm">
                      {message.content}
                    </p>

                    {/* Time + Status */}
                    <div
                      className={`mt-1 text-[10px] ${isMine
                        ? "text-blue-100"
                        : "text-gray-400"
                        }`}
                    >
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}

                      {/* Our message status */}
                      {isMine && (
                        <span className="ml-2 font-medium">
                          {message.isRead
                            ? "✓✓"
                            : message.isDelivered
                              ? "✓✓"
                              : "✓"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Auto scroll target */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ================================== */}
      {/* MESSAGE INPUT */}
      {/* ================================== */}

      <div className="shrink-0 border-t bg-white p-4">
        <div className="flex gap-2">

          <input
            type="text"
            value={content}
            onChange={(event) =>
              setContent(event.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 disabled:bg-gray-100"
          />

          <button
            type="button"
            onClick={handleSendMessage}
            disabled={
              sending ||
              !content.trim() ||
              !conversationId
            }
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>

        </div>
      </div>
    </div>
  );
}

export default ChatWindow;