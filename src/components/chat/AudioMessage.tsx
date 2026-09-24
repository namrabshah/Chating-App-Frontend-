"use client";

import React from "react";
import { formatFileSize, getAttachmentUrl } from "@/lib/file";

interface AudioMessageProps {
  url: string;
  name?: string | null;
  size?: number | null;
  isMine?: boolean;
}

export function AudioMessage({
  url,
  name,
  size,
  isMine,
}: AudioMessageProps) {
  const src = getAttachmentUrl(url);

  return (
    <div className="mb-1 w-full max-w-[280px]">
      <p
        className={`mb-1 truncate text-xs ${
          isMine ? "text-blue-100" : "text-gray-500"
        }`}
        title={name || "Audio"}
      >
        🎵 {name || "Audio"}
        {size != null ? ` · ${formatFileSize(size)}` : ""}
      </p>
      <audio controls preload="metadata" className="w-full max-w-full">
        <source src={src} />
        Your browser does not support audio playback.
      </audio>
    </div>
  );
}

export default AudioMessage;
