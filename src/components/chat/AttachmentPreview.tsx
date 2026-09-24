"use client";

import React, { useEffect, useState } from "react";
import {
  formatFileSize,
  isDocumentType,
  isImageType,
} from "@/lib/file";

interface AttachmentPreviewProps {
  file: File;
  onRemove: () => void;
}

export function AttachmentPreview({
  file,
  onRemove,
}: AttachmentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = isImageType(file.type) || file.type === "";

  useEffect(() => {
    if (!isImageType(file.type)) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (previewUrl && isImageType(file.type)) {
    return (
      <div className="relative mb-3 max-w-xs overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        <img
          src={previewUrl}
          alt={file.name}
          className="max-h-48 w-full object-contain"
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-xs text-white hover:bg-black"
        >
          Remove
        </button>
        <div className="truncate px-3 py-2 text-xs text-gray-600">
          {file.name} · {formatFileSize(file.size)}
        </div>
      </div>
    );
  }

  const icon = isDocumentType(file.type) ? "📄" : "📎";

  return (
    <div className="mb-3 flex max-w-sm items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
      <span className="text-xl" aria-hidden>
        {isImage ? "🖼️" : icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">
          {file.name}
        </p>
        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
      >
        Remove
      </button>
    </div>
  );
}

export default AttachmentPreview;
