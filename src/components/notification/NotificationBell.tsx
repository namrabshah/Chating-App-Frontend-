"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/store/notification.store";
import { getAttachmentUrl } from "@/lib/file";
import {
  isBrowserNotificationSupported,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from "@/utils/browserNotification";
import { AppNotification } from "@/types/notification";

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getNotificationTypeBadge(type: string) {
  switch (type) {
    case "MENTION":
      return (
        <span className="inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
          Mention
        </span>
      );
    case "GROUP_EVENT":
      return (
        <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-700/10">
          Group Event
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
          Message
        </span>
      );
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const loading = useNotificationStore((state) => state.loading);
  const hasMore = useNotificationStore((state) => state.hasMore);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const removeNotification = useNotificationStore((state) => state.removeNotification);
  const browserEnabled = useNotificationStore((state) => state.browserEnabled);
  const toggleBrowserEnabled = useNotificationStore((state) => state.toggleBrowserEnabled);

  // Initial fetch on mount
  useEffect(() => {
    fetchNotifications(true);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleBrowserNotif = async () => {
    if (!isBrowserNotificationSupported()) {
      alert("Browser notifications are not supported in this browser.");
      return;
    }

    const currentPerm = getBrowserNotificationPermission();
    if (currentPerm === "granted") {
      toggleBrowserEnabled();
    } else if (currentPerm === "default") {
      const res = await requestBrowserNotificationPermission();
      if (res === "granted") {
        if (!browserEnabled) toggleBrowserEnabled();
      } else {
        alert("Notification permission denied by user.");
      }
    } else {
      alert("Notification permission is currently blocked in your browser settings.");
    }
  };

  const handleNotificationClick = async (item: AppNotification) => {
    if (!item.isRead) {
      await markAsRead(item.id);
    }

    setIsOpen(false);

    if (item.conversationId) {
      let targetUrl = `/chat?conversationId=${item.conversationId}`;
      if (item.messageId) {
        targetUrl += `&messageId=${item.messageId}`;
      }
      router.push(targetUrl);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition"
        title="Notifications"
        aria-label="Notifications"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge counter */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-[-140px] sm:right-auto sm:top-full mt-2 w-auto sm:w-96 rounded-2xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5 z-50 overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-gray-50/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-800 text-sm">Notifications</h4>
              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-600">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          {/* Browser Alert Toggle */}
          {isBrowserNotificationSupported() && (
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2 bg-slate-50/50 text-xs text-gray-600">
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Desktop Alerts
              </span>
              <button
                type="button"
                onClick={handleToggleBrowserNotif}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  browserEnabled && getBrowserNotificationPermission() === "granted"
                    ? "bg-blue-600"
                    : "bg-gray-300"
                }`}
                title="Toggle Desktop Notifications"
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    browserEnabled && getBrowserNotificationPermission() === "granted"
                      ? "translate-x-4"
                      : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-2">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">When you get messages or group updates, they will appear here.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`group relative flex items-start gap-3 p-3.5 transition cursor-pointer hover:bg-blue-50/50 ${
                    !item.isRead ? "bg-blue-50/20" : "bg-white"
                  }`}
                >
                  {/* Unread dot indicator */}
                  {!item.isRead && (
                    <span className="absolute top-4 left-2 h-2 w-2 rounded-full bg-blue-600 ring-4 ring-blue-100" />
                  )}

                  {/* Avatar */}
                  <div className="relative ml-2 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-blue-600 font-semibold border border-blue-200">
                    {item.actorAvatar ? (
                      <img
                        src={getAttachmentUrl(item.actorAvatar)}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{item.title ? item.title.charAt(0).toUpperCase() : "🔔"}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="truncate text-xs font-bold text-gray-900">
                        {item.title}
                      </p>
                      {getNotificationTypeBadge(item.type)}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(item.id);
                    }}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 transition"
                    title="Delete Notification"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer Load More */}
          {hasMore && (
            <div className="border-t border-gray-100 bg-gray-50 p-2 text-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => fetchNotifications(false)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Load older notifications"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
