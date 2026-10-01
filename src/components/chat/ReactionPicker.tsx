"use client";

import React, { useEffect, useRef } from "react";

export const SUPPORTED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

const REACTION_LABELS: Record<string, string> = {
  "👍": "React with thumbs up",
  "❤️": "React with heart",
  "😂": "React with laugh",
  "😮": "React with wow",
  "😢": "React with sad",
  "😡": "React with angry",
};

interface ReactionPickerProps {
  onSelectReaction: (reaction: string) => void;
  onClose: () => void;
  currentReaction?: string | null;
  isMine?: boolean;
}

export function ReactionPicker({
  onSelectReaction,
  onClose,
  currentReaction,
  isMine = false,
}: ReactionPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className={`absolute z-30 -top-12 flex items-center gap-1 rounded-full border border-gray-200 bg-white/95 px-2 py-1 shadow-lg backdrop-blur-md transition-all duration-150 ease-out animate-in fade-in zoom-in-95 ${
        isMine ? "right-0" : "left-0"
      }`}
      role="toolbar"
      aria-label="Message reactions picker"
    >
      {SUPPORTED_REACTIONS.map((emoji) => {
        const isSelected = currentReaction === emoji;
        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectReaction(emoji);
            }}
            aria-label={REACTION_LABELS[emoji] || `React with ${emoji}`}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform duration-150 hover:scale-125 hover:bg-gray-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              isSelected ? "bg-blue-100 ring-1 ring-blue-400 scale-110" : ""
            }`}
          >
            <span>{emoji}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ReactionPicker;
