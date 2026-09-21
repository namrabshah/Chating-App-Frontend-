"use client";

import { useAuthStore } from "@/store/auth.store";
import ConversationList from "@/components/conversation/ConversationList";
import ChatWindow from "@/components/chat/ChatWindow";

export default function ChatPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <ConversationList />

      <div className="flex h-full min-w-0 flex-1 flex-col">
        {user && (
          <div className="shrink-0 border-b bg-gray-100 px-4 py-1 text-xs text-gray-500">
            Logged in as:{" "}
            <span className="font-semibold text-gray-700">
              {user.name}
            </span>{" "}
            ({user.email})
          </div>
        )}

        <ChatWindow />
      </div>
    </div>
  );
}