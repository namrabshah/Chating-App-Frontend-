"use client";

import React, { useState } from "react";
import {
  Conversation,
  GroupMember,
  updateGroup,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
} from "@/services/conversation.service";
import { searchUsers } from "@/services/user.service";
import { User } from "@/types/auth";
import { getAttachmentUrl } from "@/lib/file";
import { useAuthStore } from "@/store/auth.store";

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  onGroupUpdated: (updatedGroup: Conversation) => void;
  onLeftGroup: () => void;
}

export default function GroupInfoModal({
  isOpen,
  onClose,
  conversation,
  onGroupUpdated,
  onLeftGroup,
}: GroupInfoModalProps) {
  const currentUser = useAuthStore((state) => state.user);

  const [isEditing, setIsEditing] = useState(false);
  const [groupName, setGroupName] = useState(conversation.name || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Add members sub-state
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingLoading, setIsAddingLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<number | null>(null);

  const members = conversation.members || [];
  const currentMember = members.find(
    (m) => Number(m.id) === Number(currentUser?.id)
  );
  const isAdmin = currentMember?.role === "ADMIN";

  // Search users for adding
  React.useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const users = await searchUsers(searchQuery.trim());
        const existingIds = new Set(members.map((m) => Number(m.id)));
        const filtered = (users || []).filter(
          (u) => !existingIds.has(Number(u.id))
        );
        setSearchResults(filtered);
      } catch (err) {
        console.error("Search add members error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, members]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedName = groupName.trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 50) {
      setErrorMsg("Group name must be between 2 and 50 characters");
      return;
    }

    try {
      setIsSaving(true);
      const formData = new FormData();
      formData.append("name", trimmedName);
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const res = await updateGroup(conversation.id, formData);
      if (res.success) {
        setSuccessMsg("Group details updated");
        setIsEditing(false);
        onGroupUpdated({
          ...conversation,
          name: trimmedName,
          avatar: res.group?.avatar !== undefined ? res.group.avatar : conversation.avatar,
        });
      }
    } catch (err: any) {
      console.error("Update group error:", err);
      setErrorMsg(err.response?.data?.message || "Failed to update group");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMembersSubmit = async () => {
    if (selectedUserIds.length === 0) return;
    setErrorMsg(null);
    try {
      setIsAddingLoading(true);
      const res = await addGroupMembers(conversation.id, selectedUserIds);
      if (res.success && res.members) {
        onGroupUpdated({
          ...conversation,
          memberCount: res.members.length,
          members: res.members,
        });
        setIsAddingMembers(false);
        setSelectedUserIds([]);
        setSearchQuery("");
        setSuccessMsg("Members added successfully");
      }
    } catch (err: any) {
      console.error("Add members error:", err);
      setErrorMsg(err.response?.data?.message || "Failed to add members");
    } finally {
      setIsAddingLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    setErrorMsg(null);
    try {
      setActionUserId(memberId);
      const res = await removeGroupMember(conversation.id, memberId);
      if (res.success && res.members) {
        onGroupUpdated({
          ...conversation,
          memberCount: res.members.length,
          members: res.members,
        });
        setSuccessMsg("Member removed");
      }
    } catch (err: any) {
      console.error("Remove member error:", err);
      setErrorMsg(err.response?.data?.message || "Failed to remove member");
    } finally {
      setActionUserId(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm("Are you sure you want to leave this group?")) return;
    setErrorMsg(null);
    try {
      setIsSaving(true);
      const res = await leaveGroup(conversation.id);
      if (res.success) {
        onLeftGroup();
        onClose();
      }
    } catch (err: any) {
      console.error("Leave group error:", err);
      setErrorMsg(err.response?.data?.message || "Failed to leave group");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">Group Info</h2>
          <button
            type="button"
            onClick={onClose}
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600 border border-red-100">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="rounded-xl bg-green-50 p-3 text-xs font-medium text-green-600 border border-green-100">
              {successMsg}
            </div>
          )}

          {/* Group Header Card */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative mb-3">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-bold text-blue-600 text-2xl border-2 border-blue-200 shadow-md">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                ) : conversation.avatar ? (
                  <img
                    src={getAttachmentUrl(conversation.avatar)}
                    alt={conversation.name || "Group"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (conversation.name || "G").charAt(0).toUpperCase()
                )}
              </div>
              {isEditing && (
                <label
                  htmlFor="edit-avatar-input"
                  className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 transition"
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
                  </svg>
                  <input
                    id="edit-avatar-input"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveGroup} className="w-full space-y-3">
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-center text-sm font-semibold text-gray-800 focus:border-blue-500 focus:bg-white focus:outline-none"
                  maxLength={50}
                />
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setGroupName(conversation.name || "");
                      setAvatarFile(null);
                      setAvatarPreview(null);
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">
                  {conversation.name || "Group Chat"}
                </h3>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-gray-400 hover:text-blue-600 transition"
                    title="Edit Name/Avatar"
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
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500 mt-1">
              {members.length} members
            </p>
          </div>

          {/* Add Members Section (Admin) */}
          {isAdmin && (
            <div className="border-t border-gray-100 pt-4">
              {!isAddingMembers ? (
                <button
                  type="button"
                  onClick={() => setIsAddingMembers(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Members
                </button>
              ) : (
                <div className="space-y-3 rounded-xl bg-gray-50 p-3.5 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800">
                      Add New Members
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingMembers(false);
                        setSelectedUserIds([]);
                        setSearchQuery("");
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {isSearching ? (
                    <p className="text-center text-[11px] text-gray-400 py-1">
                      Searching...
                    </p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-center text-[11px] text-gray-400 py-1">
                      {searchQuery ? "No eligible users found" : "Type to search users"}
                    </p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {searchResults.map((u) => {
                        const isSel = selectedUserIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() =>
                              setSelectedUserIds((prev) =>
                                isSel
                                  ? prev.filter((id) => id !== u.id)
                                  : [...prev, u.id]
                              )
                            }
                            className={`w-full flex items-center justify-between rounded-lg p-2 text-left text-xs transition ${
                              isSel ? "bg-blue-100/70" : "hover:bg-white"
                            }`}
                          >
                            <span className="font-semibold text-gray-800">
                              {u.name}
                            </span>
                            <span className="text-[10px] text-blue-600">
                              {isSel ? "✓ Selected" : "+ Add"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selectedUserIds.length > 0 && (
                    <button
                      type="button"
                      disabled={isAddingLoading}
                      onClick={handleAddMembersSubmit}
                      className="w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
                    >
                      {isAddingLoading ? "Adding..." : `Confirm Add (${selectedUserIds.length})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Members List */}
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">
              Members ({members.length})
            </h4>
            <div className="space-y-2">
              {members.map((member) => {
                const isSelf = Number(member.id) === Number(currentUser?.id);
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-xl p-2 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-semibold text-blue-600 text-xs">
                        {member.avatar ? (
                          <img
                            src={getAttachmentUrl(member.avatar)}
                            alt={member.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          member.name ? member.name.charAt(0).toUpperCase() : "?"
                        )}
                        {member.isOnline && (
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-gray-800">
                            {member.name} {isSelf && "(You)"}
                          </p>
                          {member.role === "ADMIN" && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-gray-500">
                          {member.email}
                        </p>
                      </div>
                    </div>

                    {isAdmin && !isSelf && (
                      <button
                        type="button"
                        disabled={actionUserId === member.id}
                        onClick={() => handleRemoveMember(member.id)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition text-xs font-semibold"
                        title="Remove Member"
                      >
                        {actionUserId === member.id ? "..." : "Remove"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave Group Action */}
          <div className="border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={handleLeaveGroup}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100 transition shadow-sm"
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Leave Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
