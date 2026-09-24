"use client";

import React from "react";
import { formatFileSize, getAttachmentUrl } from "@/lib/file";

interface VideoMessageProps {
  url: string;
  name?: string | null;
  size?: number | null;
  isMine?: boolean;
}

export function VideoMessage({
  url,
  name,
  size,
  isMine,
}: VideoMessageProps) {
  const src = getAttachmentUrl(url);

  return (
    <div className="mb-1 w-full max-w-[280px]">
      {(name || size != null) && (
        <p
          className={`mb-1 truncate text-xs ${
            isMine ? "text-blue-100" : "text-gray-500"
          }`}
          title={name || "Video"}
        >
          🎬 {name || "Video"}
          {size != null ? ` · ${formatFileSize(size)}` : ""}
        </p>
      )}
      <video
        controls
        preload="metadata"
        className="max-h-64 w-full max-w-full rounded-xl bg-black"
      >
        <source src={src} />
        Your browser does not support video playback.
      </video>
    </div>
  );
}

export default VideoMessage;
