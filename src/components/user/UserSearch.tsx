"use client";

import { useEffect, useState } from "react";
import { searchUsers } from "@/services/user.service";
import { User } from "@/types/auth";
import { getAttachmentUrl } from "@/lib/file";

interface UserSearchProps {
  onUserSelect?: (user: User) => void;
}

export default function UserSearch({
  onUserSelect,
}: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectingUserId, setSelectingUserId] = useState<number | null>(null);

  useEffect(() => {
    const trimmedQuery = query.trim();

    const timer = setTimeout(async () => {
      if (trimmedQuery.length < 2) {
        setUsers([]);
        setError("");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError("");

        const results = await searchUsers(trimmedQuery);

        setUsers(results);
      } catch (error) {
        console.error("User search error:", error);

        setUsers([]);
        setError("Unable to search users");
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectUser = async (user: User) => {
    if (selectingUserId !== null) return;

    try {
      setSelectingUserId(user.id);
      if (onUserSelect) {
        await onUserSelect(user);
      }
      setQuery("");
      setUsers([]);
    } catch (err) {
      console.error("Failed to select user:", err);
    } finally {
      setSelectingUserId(null);
    }
  };

  return (
    <div className="w-full">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users..."
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:bg-white"
        />

        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mt-2 px-1 text-xs text-red-500">
          {error}
        </p>
      )}

      {/* Search Results */}
      {users.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {users.map((user) => {
            const isSelectingThisUser = selectingUserId === user.id;

            return (
              <button
                key={user.id}
                type="button"
                disabled={selectingUserId !== null}
                onClick={() => handleSelectUser(user)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {/* Avatar */}
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                  {user.avatar ? (
                    <img
                      src={getAttachmentUrl(user.avatar)}
                      alt={user.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}

                  {/* Online Dot */}
                  {user.isOnline && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                  )}
                </div>

                {/* User Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {user.name}
                  </p>

                  <p className="truncate text-xs text-gray-500">
                    {user.email}
                  </p>
                </div>

                {/* Action Button Label */}
                <div className="shrink-0">
                  {isSelectingThisUser ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600 border border-blue-200">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      Opening...
                    </span>
                  ) : user.hasActiveConversation ? (
                    <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600 transition">
                      Open Chat
                    </span>
                  ) : (
                    <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-blue-700">
                      Start Chat
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* No Results */}
      {query.trim().length >= 2 &&
        !loading &&
        !error &&
        users.length === 0 && (
          <p className="mt-3 px-1 text-xs text-gray-500">
            No users found
          </p>
        )}
    </div>
  );
}