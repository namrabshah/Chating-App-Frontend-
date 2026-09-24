"use client";

import React from "react";
import {
  formatFileSize,
  getAttachmentUrl,
  getFileExtension,
} from "@/lib/file";

interface FileMessageProps {
  url: string;
  name?: string | null;
  type?: string | null;
  size?: number | null;
  isMine?: boolean;
}

export function FileMessage({
  url,
  name,
  type,
  size,
  isMine,
}: FileMessageProps) {
  const src = getAttachmentUrl(url);
  const displayName = name || "document";
  const ext = getFileExtension(displayName).replace(".", "").toUpperCase();
  const canOpenInline =
    type === "application/pdf" ||
    type === "text/plain" ||
    type === "text/csv" ||
    type?.startsWith("image/");

  return (
    <div
      className={`mb-1 min-w-[180px] max-w-full rounded-xl border px-3 py-2.5 ${
        isMine
          ? "border-blue-400/40 bg-blue-500/30"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-xl" aria-hidden>
          📄
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-medium ${
              isMine ? "text-white" : "text-gray-800"
            }`}
            title={displayName}
          >
            {displayName}
          </p>
          <p
            className={`mt-0.5 text-xs ${
              isMine ? "text-blue-100" : "text-gray-500"
            }`}
          >
            {ext || "FILE"}
            {size != null ? ` · ${formatFileSize(size)}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {canOpenInline && (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              isMine
                ? "bg-white/20 text-white hover:bg-white/30"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Open
          </a>
        )}
        <a
          href={src}
          download={displayName}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            isMine
              ? "bg-white/20 text-white hover:bg-white/30"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Download
        </a>
      </div>
    </div>
  );
}

export default FileMessage;
