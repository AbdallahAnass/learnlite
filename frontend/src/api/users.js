// users.js — API calls for the current user's profile and avatar.

import { apiFetch, BASE_URL } from "./client";
import { getToken } from "@/lib/auth";

// Fetch the currently authenticated user's full profile
// (first_name, last_name, email, bio, role, avatar_url, etc.)
export function getProfile() {
  return apiFetch("/users/me");
}

// Update editable profile fields: first_name, last_name, bio
export function updateProfile(data) {
  return apiFetch("/users/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Fetch the user's avatar as a Blob object URL.
// Used in ProfilePage — raw fetch is needed because the response is binary image data.
// The caller is responsible for calling URL.revokeObjectURL when done.
export async function fetchAvatarUrl() {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/users/me/avatar`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("no avatar");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// Upload a new avatar image (replaces any existing one).
// Sent as multipart/form-data because the backend expects a file upload.
export async function uploadAvatar(file) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/users/me/avatar`, {
    method: "POST",
    // No Content-Type header — browser sets it automatically with the correct boundary
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed." }));
    throw new Error(err.detail || "Upload failed.");
  }
  return res.json();
}

// Delete the user's current avatar (reverts to initials placeholder)
export function deleteAvatar() {
  return apiFetch("/users/me/avatar", { method: "DELETE" });
}
