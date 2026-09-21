"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import UserSearch from "@/components/user/UserSearch";

import {
  createConversation,
  getConversationDetails,
  getMyConversations,
} from "@/services/conversation.service";

import { User } from "@/types/auth";

interface ConversationItem {
  id: number;
  createdAt: string;
  updatedAt: string;
  otherUser: User;
}

export function ConversationList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedConversationId =
    Number(searchParams.get("conversationId")) || null;

  const [conversations, setConversations] = useState<
    ConversationItem[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // ========================================
  // LOAD EXISTING CONVERSATIONS
  // ========================================

  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);

        const conversationList = await getMyConversations();

        const detailedConversations = await Promise.all(
          conversationList.map(async (conversation) => {
            try {
              const details = await getConversationDetails(
                conversation.id
              );

              return {
                id: conversation.id,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
                otherUser: details.otherUser,
              };
            } catch (error) {
              console.error(
                `Failed to load conversation ${conversation.id}:`,
                error
              );

              return null;
            }
          })
        );

        setConversations(
          detailedConversations.filter(
            (conversation): conversation is ConversationItem =>
              conversation !== null
          )
        );
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
  // CREATE / OPEN CONVERSATION
  // ========================================

  const handleUserSelect = async (user: User) => {
    try {
      setCreating(true);

      // Check if conversation already exists
      const existingConversation = conversations.find(
        (conversation) =>
          conversation.otherUser.id === user.id
      );

      if (existingConversation) {
        router.push(
          `/chat?conversationId=${existingConversation.id}`
        );
        return;
      }

      // Create new conversation
      const result = await createConversation(user.id);

      const conversationId = result.conversation.id;

      // Add newly created conversation to sidebar
      const details = await getConversationDetails(
        conversationId
      );

      setConversations((previous) => [
        {
          id: conversationId,
          createdAt: details.createdAt,
          updatedAt: details.updatedAt,
          otherUser: details.otherUser,
        },
        ...previous,
      ]);

      router.push(
        `/chat?conversationId=${conversationId}`
      );
    } catch (error) {
      console.error("Create conversation error:", error);
      alert("Unable to start conversation");
    } finally {
      setCreating(false);
    }
  };

  // ========================================
  // OPEN EXISTING CONVERSATION
  // ========================================

  const handleConversationClick = (
    conversationId: number
  ) => {
    router.push(
      `/chat?conversationId=${conversationId}`
    );
  };

  // ========================================
  // FORMAT TIME
  // ========================================

  const formatTime = (date: string) => {
    const messageDate = new Date(date);

    if (Number.isNaN(messageDate.getTime())) {
      return "";
    }

    return messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ========================================
  // UI
  // ========================================

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-gray-200 bg-gray-50">

      {/* Header */}
      <div className="p-4">
        <h3 className="mb-4 font-semibold text-gray-700">
          Conversations
        </h3>

        <UserSearch
          onUserSelect={handleUserSelect}
        />

        {creating && (
          <p className="mt-3 text-xs text-blue-500">
            Opening conversation...
          </p>
        )}
      </div>

      {/* Conversation List */}
      <div className="min-h-0 flex-1 overflow-y-auto">

        {loading ? (
          <div className="px-4 py-5">
            <p className="text-sm text-gray-400">
              Loading conversations...
            </p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-5">
            <p className="text-sm text-gray-400">
              No active conversations
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {conversations.map((conversation) => {
              const user = conversation.otherUser;

              const isSelected =
                selectedConversationId ===
                conversation.id;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() =>
                    handleConversationClick(
                      conversation.id
                    )
                  }
                  className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition ${
                    isSelected
                      ? "bg-blue-50"
                      : "bg-gray-50 hover:bg-gray-100"
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
                      user.name
                        .charAt(0)
                        .toUpperCase()
                    )}

                    {user.isOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                    )}
                  </div>

                  {/* User Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="truncate text-sm font-semibold text-gray-800">
                        {user.name}
                      </h4>

                      <span className="shrink-0 text-[11px] text-gray-400">
                        {formatTime(
                          conversation.updatedAt
                        )}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-xs text-gray-500">
                      {user.email}
                    </p>
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