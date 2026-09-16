"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import UserSearch from "@/components/user/UserSearch";
import { createConversation } from "@/services/conversation.service";
import { User } from "@/types/auth";

export function ConversationList() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleUserSelect = async (user: User) => {
    try {
      setCreating(true);

      const result = await createConversation(user.id);

      console.log("Conversation created:", result);

      const conversationId = result.conversation.id;

      router.push(`/chat?conversationId=${conversationId}`);
    } catch (error) {
      console.error("Create conversation error:", error);
      alert("Unable to start conversation");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full w-80 flex-col border-r border-gray-200 bg-gray-50 p-4">
      <h3 className="mb-4 font-semibold text-gray-700">
        Conversations
      </h3>

      <UserSearch onUserSelect={handleUserSelect} />

      {creating && (
        <p className="mt-3 text-xs text-blue-500">
          Starting conversation...
        </p>
      )}

      <div className="mt-4">
        <p className="text-sm text-gray-400">
          No active conversations
        </p>
      </div>
    </div>
  );
}

export default ConversationList;