"use client";

import React, { useState } from "react";
import {
  formatFileSize,
  getAttachmentUrl,
} from "@/lib/file";

interface ImageMessageProps {
  url: string;
  name?: string | null;
  isMine?: boolean;
}

export function ImageMessage({ url, name, isMine }: ImageMessageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const src = getAttachmentUrl(url);

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="mb-1 block w-full overflow-hidden rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        <img
          src={src}
          alt={name || "Image"}
          className="max-h-72 max-w-full rounded-xl object-contain"
          loading="lazy"
        />
      </button>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className={`absolute right-4 top-4 rounded-md px-3 py-1.5 text-sm text-white ${
              isMine ? "bg-white/20" : "bg-white/20"
            }`}
          >
            Close
          </button>
          <img
            src={src}
            alt={name || "Image preview"}
            className="max-h-[90vh] max-w-[95vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

export default ImageMessage;
