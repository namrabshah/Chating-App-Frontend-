"use client";

import React, { useState, useEffect } from "react";
import { User } from "@/types/auth";
import { getBlockedUsers, unblockUser } from "@/services/user.service";
import { getAttachmentUrl } from "@/lib/file";

interface BlockedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserUnblocked?: (userId: number) => void;
}

export default function BlockedUsersModal({
  isOpen,
  onClose,
  onUserUnblocked,
}: BlockedUsersModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBlockedUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await getBlockedUsers();
      setUsers(list);
    } catch (err: any) {
      console.error("Failed to load blocked users:", err);
      setError("Failed to load blocked users list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBlockedUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUnblock = async (user: User) => {
    try {
      setUnblockingId(user.id);
      setError(null);
      await unblockUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (onUserUnblocked) {
        onUserUnblocked(user.id);
      }
    } catch (err: any) {
      console.error("Failed to unblock user:", err);
      setError(`Failed to unblock ${user.name}`);
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h2 className="text-lg font-bold text-gray-900">Blocked Users</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 border border-red-100">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">
              Loading blocked users...
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No blocked users
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-3 px-1 transition hover:bg-gray-50/50 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-semibold text-blue-600 border border-blue-200">
                      {user.avatar ? (
                        <img
                          src={getAttachmentUrl(user.avatar)}
                          alt={user.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        user.name ? user.name.charAt(0).toUpperCase() : "?"
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-800">
                        {user.name}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnblock(user)}
                    disabled={unblockingId === user.id}
                    className="ml-2 shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 transition"
                  >
                    {unblockingId === user.id ? "Unblocking..." : "Unblock"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
