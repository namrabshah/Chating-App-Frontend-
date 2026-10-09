"use client";

import React, { useState, useEffect } from "react";
import { searchUsers } from "@/services/user.service";
import { createGroup, Conversation } from "@/services/conversation.service";
import { User } from "@/types/auth";
import { getAttachmentUrl } from "@/lib/file";
import { useAuthStore } from "@/store/auth.store";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (group: Conversation) => void;
}

export default function CreateGroupModal({
  isOpen,
  onClose,
  onGroupCreated,
}: CreateGroupModalProps) {
  const currentUser = useAuthStore((state) => state.user);

  const [step, setStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  // Step 2 state
  const [groupName, setGroupName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search users on query change
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const users = await searchUsers(searchQuery.trim());
        // Filter out current user
        const filtered = (users || []).filter(
          (u) => Number(u.id) !== Number(currentUser?.id)
        );
        setSearchResults(filtered);
      } catch (err) {
        console.error("Search users error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser?.id]);

  const toggleSelectUser = (user: User) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      if (exists) {
        return prev.filter((u) => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg("Avatar file size must be less than 10MB");
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setErrorMsg(null);
    }
  };

  const resetState = () => {
    setStep(1);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedUsers([]);
    setGroupName("");
    setAvatarFile(null);
    setAvatarPreview(null);
    setErrorMsg(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = groupName.trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 50) {
      setErrorMsg("Group name must be between 2 and 50 characters");
      return;
    }

    if (selectedUsers.length < 1) {
      setErrorMsg("Please select at least 1 other member");
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();
      formData.append("name", trimmedName);
      formData.append(
        "memberIds",
        JSON.stringify(selectedUsers.map((u) => u.id))
      );
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const response = await createGroup(formData);
      if (response.success && response.conversation) {
        onGroupCreated(response.conversation);
        handleClose();
      } else {
        setErrorMsg(response.message || "Failed to create group");
      }
    } catch (err: any) {
      console.error("Create group submit error:", err);
      const msg = err.response?.data?.message || "Failed to create group";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {step === 1 ? "Create New Group" : "Group Details"}
            </h2>
            <p className="text-xs text-gray-500">
              {step === 1
                ? "Step 1 of 2: Select Members"
                : "Step 2 of 2: Set Group Info"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600 border border-red-100">
              {errorMsg}
            </div>
          )}

          {step === 1 ? (
            <div className="flex flex-col gap-4">
              {/* Selected Pills */}
              {selectedUsers.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">
                      Selected Members ({selectedUsers.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-1">
                    {selectedUsers.map((user) => (
                      <span
                        key={user.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-200"
                      >
                        <span className="truncate max-w-[100px]">
                          {user.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSelectUser(user)}
                          className="rounded-full hover:bg-blue-100 p-0.5 text-blue-600 transition"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Bar */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Search Users
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type name or email..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 pl-10 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                  />
                  <svg
                    className="absolute left-3 top-3 h-4 w-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>

              {/* Users Result List */}
              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto mt-1 border border-gray-100 rounded-xl p-1">
                {isSearching ? (
                  <p className="p-4 text-center text-xs text-gray-400">
                    Searching users...
                  </p>
                ) : searchResults.length === 0 ? (
                  <p className="p-4 text-center text-xs text-gray-400">
                    {searchQuery.trim().length < 2
                      ? "Search users to add to your group"
                      : "No users found"}
                  </p>
                ) : (
                  searchResults.map((user) => {
                    const isSelected = selectedUsers.some(
                      (u) => u.id === user.id
                    );
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleSelectUser(user)}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                          isSelected
                            ? "bg-blue-50/70 border border-blue-200"
                            : "hover:bg-gray-50 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-semibold text-blue-600 text-xs">
                            {user.avatar ? (
                              <img
                                src={getAttachmentUrl(user.avatar)}
                                alt={user.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              user.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-800">
                              {user.name}
                            </p>
                            <p className="truncate text-[11px] text-gray-500">
                              {user.email}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateGroup} className="flex flex-col gap-5">
              {/* Group Avatar Upload */}
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="relative group">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-bold text-blue-600 text-2xl border-2 border-blue-200 shadow-inner">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Group Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <svg
                        className="h-10 w-10 text-blue-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    )}
                  </div>
                  <label
                    htmlFor="group-avatar-input"
                    className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 transition"
                    title="Upload Avatar"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </label>
                  <input
                    id="group-avatar-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                <span className="text-[11px] text-gray-500">
                  Optional Group Photo
                </span>
              </div>

              {/* Group Name Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Family Group, Project Work"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                  maxLength={50}
                />
              </div>

              {/* Members Summary */}
              <div className="rounded-xl bg-gray-50 p-3 border border-gray-100">
                <span className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Members ({selectedUsers.length + 1})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                    You (Admin)
                  </span>
                  {selectedUsers.map((u) => (
                    <span
                      key={u.id}
                      className="rounded-full bg-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-700"
                    >
                      {u.name}
                    </span>
                  ))}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 bg-gray-50/50">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedUsers.length === 0}
                onClick={() => setStep(2)}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 shadow-md transition flex items-center gap-1.5"
              >
                Next →
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={isSubmitting || !groupName.trim()}
                onClick={handleCreateGroup}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 shadow-md transition flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Group</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
