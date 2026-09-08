"use client";

import { useAuthStore } from "@/store/auth.store";
import ConversationList from "@/components/conversation/ConversationList";
import ChatWindow from "@/components/chat/ChatWindow";

export default function ChatPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex w-full h-screen overflow-hidden">
      <ConversationList />
      <div className="flex-1 flex flex-col h-full">
        {user && (
          <div className="bg-gray-100 px-4 py-1 text-xs text-gray-500 border-b">
            Logged in as: <span className="font-semibold text-gray-700">{user.name}</span> ({user.email})
          </div>
        )}
        <ChatWindow />
      </div>
    </div>
  );
}