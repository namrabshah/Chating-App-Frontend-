"use client";

import React from "react";
import { Message } from "@/types/message";
import {
  isAudioType,
  isDocumentType,
  isImageType,
  isVideoType,
} from "@/lib/file";
import { ImageMessage } from "./ImageMessage";
import { FileMessage } from "./FileMessage";
import { AudioMessage } from "./AudioMessage";
import { VideoMessage } from "./VideoMessage";

interface AttachmentMessageProps {
  message: Message;
  isMine: boolean;
}

export function AttachmentMessage({
  message,
  isMine,
}: AttachmentMessageProps) {
  const {
    attachmentUrl,
    attachmentName,
    attachmentType,
    attachmentSize,
  } = message;

  if (!attachmentUrl) return null;

  if (isImageType(attachmentType)) {
    return (
      <ImageMessage
        url={attachmentUrl}
        name={attachmentName}
        isMine={isMine}
      />
    );
  }

  if (isAudioType(attachmentType)) {
    return (
      <AudioMessage
        url={attachmentUrl}
        name={attachmentName}
        size={attachmentSize}
        isMine={isMine}
      />
    );
  }

  if (isVideoType(attachmentType)) {
    return (
      <VideoMessage
        url={attachmentUrl}
        name={attachmentName}
        size={attachmentSize}
        isMine={isMine}
      />
    );
  }

  if (
    isDocumentType(attachmentType) ||
    attachmentType === "application/zip" ||
    attachmentType === "application/x-zip-compressed" ||
    attachmentUrl
  ) {
    return (
      <FileMessage
        url={attachmentUrl}
        name={attachmentName}
        type={attachmentType}
        size={attachmentSize}
        isMine={isMine}
      />
    );
  }

  return null;
}

export default AttachmentMessage;
