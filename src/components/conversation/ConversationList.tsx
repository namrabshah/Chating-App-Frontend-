"use client";

import React from "react";

export function ConversationList() {
  return (
    <div className="w-80 border-r border-gray-200 h-full flex flex-col bg-gray-50 p-4">
      <h3 className="font-semibold text-gray-700 mb-4">Conversations</h3>
      <p className="text-sm text-gray-400">No active conversations</p>
    </div>
  );
}

export default ConversationList;
