export function isBrowserNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isBrowserNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isBrowserNotificationSupported()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error("Browser notification permission request error:", error);
    return Notification.permission;
  }
}

export function triggerBrowserNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    onClick?: () => void;
  }
): void {
  if (!isBrowserNotificationSupported()) return;
  if (Notification.permission !== "granted") return;

  try {
    const notification = new Notification(title, {
      icon: options?.icon || "/favicon.ico",
      body: options?.body || "",
      tag: options?.tag,
    });

    if (options?.onClick) {
      notification.onclick = (e) => {
        e.preventDefault();
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }
  } catch (error) {
    console.error("Failed to show browser notification:", error);
  }
}
