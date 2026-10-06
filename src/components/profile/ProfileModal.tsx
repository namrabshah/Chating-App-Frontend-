"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth.store";
import { updateMyProfile } from "@/services/user.service";
import { getAttachmentUrl } from "@/lib/file";
import BlockedUsersModal from "@/components/user/BlockedUsersModal";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const currentUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [name, setName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || "");
      setAvatarFile(null);
      setAvatarPreview(null);
      setError(null);
      setSuccess(null);
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      setError("Please select a valid image file (JPG, PNG, WEBP, or GIF)");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setError("Avatar file size must be less than 5MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name cannot be empty");
      return;
    }

    if (trimmedName.length < 2 || trimmedName.length > 50) {
      setError("Name must be between 2 and 50 characters");
      return;
    }

    try {
      setSaving(true);

      const updatedUser = await updateMyProfile({
        name: trimmedName,
        avatarFile: avatarFile,
      });

      setUser(updatedUser);
      setSuccess("Profile updated successfully!");
      setAvatarFile(null);
      setAvatarPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update profile. Please try again.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const currentAvatarUrl = avatarPreview
    ? avatarPreview
    : currentUser.avatar
    ? getAttachmentUrl(currentUser.avatar)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h2 className="text-lg font-bold text-gray-900">Profile</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content / Form */}
        <form onSubmit={handleSave} className="mt-5 space-y-5">
          {/* Alerts */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 border border-red-100">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-xs text-green-600 border border-green-100">
              {success}
            </div>
          )}

          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-gray-100 bg-blue-100 font-bold text-2xl text-blue-600 shadow-sm">
              {currentAvatarUrl ? (
                <img
                  src={currentAvatarUrl}
                  alt={currentUser.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "?"
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50"
            >
              Change Avatar
            </button>
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              required
              minLength={2}
              maxLength={50}
              placeholder="Enter your name"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          {/* Email Field (Read-only) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Email <span className="text-[10px] font-normal text-gray-400">(read-only)</span>
            </label>
            <input
              type="email"
              value={currentUser.email}
              readOnly
              disabled
              className="w-full rounded-xl border border-gray-200 bg-gray-100 px-3.5 py-2.5 text-sm text-gray-500 cursor-not-allowed select-none"
            />
          </div>

          {/* Blocked Users Action */}
          <div className="border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setIsBlockedModalOpen(true)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              🚫 Manage Blocked Users
            </button>
          </div>

          {/* Submit Action */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>

        <BlockedUsersModal
          isOpen={isBlockedModalOpen}
          onClose={() => setIsBlockedModalOpen(false)}
        />
      </div>
    </div>
  );
}
