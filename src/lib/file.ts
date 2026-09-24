const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".zip",
  ".mp3",
  ".wav",
  ".ogg",
  ".mp4",
  ".webm",
  ".mov",
]);

const DANGEROUS_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".msi",
  ".com",
  ".scr",
  ".dll",
  ".js",
  ".vbs",
  ".jar",
]);

export function formatFileSize(bytes?: number | null): string {
  if (bytes == null || Number.isNaN(bytes) || bytes < 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb % 1 === 0 ? kb : kb.toFixed(1)} KB`;
  }

  const mb = bytes / (1024 * 1024);
  return `${mb % 1 === 0 ? mb : mb.toFixed(1)} MB`;
}

export function getFileExtension(filename?: string | null): string {
  if (!filename) return "";
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  return filename.slice(idx).toLowerCase();
}

export function isImageType(mime?: string | null): boolean {
  return Boolean(mime && mime.startsWith("image/"));
}

export function isAudioType(mime?: string | null): boolean {
  return Boolean(mime && mime.startsWith("audio/"));
}

export function isVideoType(mime?: string | null): boolean {
  return Boolean(mime && mime.startsWith("video/"));
}

export function isDocumentType(mime?: string | null): boolean {
  if (!mime) return false;

  return (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.ms-excel" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-powerpoint" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime === "text/plain" ||
    mime === "text/csv"
  );
}

export function getAttachmentUrl(attachmentUrl?: string | null): string {
  if (!attachmentUrl) return "";

  if (
    attachmentUrl.startsWith("http://") ||
    attachmentUrl.startsWith("https://")
  ) {
    return attachmentUrl;
  }

  const base =
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
    "http://localhost:5000";

  return `${base.replace(/\/$/, "")}${
    attachmentUrl.startsWith("/") ? attachmentUrl : `/${attachmentUrl}`
  }`;
}

export function getLastMessagePreview(message: {
  content?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
} | null): string {
  if (!message) return "No messages yet";

  const content = message.content?.trim();
  if (content) return content;

  const type = message.attachmentType || "";
  const name = message.attachmentName || "file";

  if (type.startsWith("image/")) return "📷 Photo";
  if (type.startsWith("audio/")) return `🎵 ${name}`;
  if (type.startsWith("video/")) return `🎬 ${name}`;
  if (type === "application/pdf") return `📄 ${name}`;
  if (isDocumentType(type)) return `📄 ${name}`;
  if (
    type === "application/zip" ||
    type === "application/x-zip-compressed"
  ) {
    return `📎 ${name}`;
  }
  if (message.attachmentName || message.attachmentType) {
    return `📎 ${name}`;
  }

  return "No messages yet";
}

export function validateAttachmentFile(file: File): string | null {
  if (!file) return "No file selected";

  if (file.size > MAX_FILE_SIZE) {
    return "File size exceeds the 20 MB limit";
  }

  const ext = getFileExtension(file.name);

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return "Executable or dangerous file types are not allowed";
  }

  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    return "Unsupported file type";
  }

  return null;
}

export const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".zip",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  ".mp3",
  ".wav",
  ".ogg",
  ".mp4",
  ".webm",
  ".mov",
].join(",");
