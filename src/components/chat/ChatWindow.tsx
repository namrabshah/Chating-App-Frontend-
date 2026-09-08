"use client";

import React from "react";

export function ChatWindow() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white p-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800">Select a conversation</h2>
        <p className="text-sm text-gray-500 mt-1">Choose a user from the sidebar to start chatting</p>
      </div>
    </div>
  );
}

export default ChatWindow;
