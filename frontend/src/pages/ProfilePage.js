// ProfilePage.js — Shared profile page accessible by all roles.

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Mail, Pencil, Trash2, X } from "lucide-react";
import StudentLayout from "@/components/StudentLayout";
import InstructorLayout from "@/components/InstructorLayout";
import AdminLayout from "@/components/AdminLayout";
import { getUser } from "@/lib/auth";
import {
  deleteAvatar,
  fetchAvatarUrl,
  getProfile,
  updateProfile,
  uploadAvatar,
} from "@/api/users";

// Human-readable role labels shown in the role badge
const ROLE_LABEL = {
  student: "Student",
  instructor: "Instructor",
  administrator: "Admin",
};

// Tailwind color combinations for the role badge
const ROLE_COLORS = {
  student: "bg-blue-50 text-blue-700 border-blue-200",
  instructor: "bg-violet-50 text-violet-700 border-violet-200",
  administrator: "bg-amber-50 text-amber-700 border-amber-200",
};

// Return the correct layout component for the user's role so the sidebar/navbar
// matches the rest of their portal experience.
function layoutForRole(role) {
  if (role === "instructor") return InstructorLayout;
  if (role === "administrator") return AdminLayout;
  return StudentLayout;
}

export default function ProfilePage() {
  // Read role from JWT (no network call needed)
  const user = getUser();

  // Ref for the hidden file input used to trigger the OS file picker
  const fileRef = useRef(null);

  // profile: full API response object; null while loading
  const [profile, setProfile] = useState(null);
  // avatarUrl: object URL created from the avatar Blob; null if no avatar uploaded
  const [avatarUrl, setAvatarUrl] = useState(null);
  // editing: whether the profile fields are in edit mode
  const [editing, setEditing] = useState(false);
  // form: controlled inputs for the edit form
  const [form, setForm] = useState({ first_name: "", last_name: "", bio: "" });
  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load profile data on mount
  useEffect(() => {
    getProfile()
      .then((data) => {
        setProfile(data);
        // Pre-populate the edit form so entering edit mode immediately shows current values
        setForm({
          first_name: data.first_name,
          last_name: data.last_name,
          bio: data.bio || "",
        });
        // Only fetch the avatar binary if the backend says one exists
        if (data.avatar_url) {
          fetchAvatarUrl()
            .then(setAvatarUrl)
            .catch(() => {});
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  // Show a success message for 3 seconds then auto-dismiss
  function flash(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  }

  // Enter edit mode — reset form to the latest saved values
  function startEdit() {
    setForm({
      first_name: profile.first_name,
      last_name: profile.last_name,
      bio: profile.bio || "",
    });
    setEditing(true);
    setError("");
    setSuccess("");
  }

  // Cancel edit mode without saving
  function cancelEdit() {
    setEditing(false);
    setError("");
  }

  // Save the updated profile fields
  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const updated = await updateProfile(form);
      setProfile(updated); // Reflect the server-confirmed values in the UI
      setEditing(false);
      flash("Profile updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Handle the file input change event when the user picks an avatar image
  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Clear the input value so the same file can be re-selected if needed
    e.target.value = "";
    setAvatarLoading(true);
    setError("");
    try {
      await uploadAvatar(file);
      // Fetch the freshly uploaded avatar as a Blob URL so we can display it
      const url = await fetchAvatarUrl();
      setAvatarUrl(url);
      // Mark avatar_url as "set" so the delete button appears without a full re-fetch
      setProfile((p) => ({ ...p, avatar_url: "set" }));
      flash("Avatar updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarLoading(false);
    }
  }

  // Remove the current avatar and revert to the initials placeholder
  async function handleAvatarDelete() {
    setAvatarLoading(true);
    setError("");
    try {
      await deleteAvatar();
      setAvatarUrl(null);
      setProfile((p) => ({ ...p, avatar_url: null }));
      flash("Avatar removed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarLoading(false);
    }
  }

  // Pick the correct layout shell based on role
  const Layout = layoutForRole(user?.role);

  // Two-letter initials for the fallback avatar placeholder
  const initials = profile
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : "";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-foreground mb-6">My Profile</h1>

        {/* Error / success banners */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {/* Skeleton placeholder while the profile API call is in-flight */}
        {!profile ? (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-8 animate-pulse">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-20 h-20 rounded-full bg-muted" />
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-muted rounded w-40" />
                <div className="h-4 bg-muted rounded w-28" />
              </div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            {/* ── Avatar / header strip ────────────────────────────────── */}
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 px-8 py-8 flex items-center gap-6 border-b border-border">
              {/* Avatar circle — shows image if uploaded, else initials */}
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/20 ring-4 ring-white shadow flex items-center justify-center text-primary text-2xl font-bold select-none">
                    {initials}
                  </div>
                )}
                {/* Spinner overlay while the avatar upload/delete is in progress */}
                {avatarLoading && (
                  <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Name, email, and role badge */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-foreground capitalize">
                  {profile.first_name} {profile.last_name}
                </h2>
                <p className="text-sm text-muted-foreground mb-3">
                  {profile.email}
                </p>
                {/* Role badge with per-role color coding */}
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    ROLE_COLORS[profile.role] ||
                    "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {ROLE_LABEL[profile.role] || profile.role}
                </span>
              </div>

              {/* Avatar action buttons (upload / remove) */}
              <div className="flex flex-col gap-2 shrink-0">
                {/* Hidden file input — triggered programmatically by the button below */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-border hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {avatarUrl ? "Change" : "Upload"}
                </button>
                {/* Only show the remove button when an avatar is set */}
                {avatarUrl && (
                  <button
                    onClick={handleAvatarDelete}
                    disabled={avatarLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-destructive border border-destructive/20 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* ── Profile fields ────────────────────────────────────────── */}
            <div className="px-8 py-6">
              {/* Section header + Edit / Save / Cancel toggle */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-foreground">
                  Profile Information
                </h3>
                {!editing ? (
                  // View mode — show Edit button
                  <button
                    onClick={startEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary border border-primary/20 hover:bg-primary/5 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                ) : (
                  // Edit mode — show Cancel and Save buttons
                  <div className="flex items-center gap-2">
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:bg-secondary transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {/* Email — always read-only; changing email requires a separate flow */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Email
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-muted-foreground">
                    <Mail className="w-4 h-4 shrink-0" />
                    {profile.email}
                  </div>
                </div>

                {/* First / last name — inputs in edit mode, static text in view mode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      First Name
                    </label>
                    {editing ? (
                      <input
                        value={form.first_name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, first_name: e.target.value }))
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    ) : (
                      <p className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground capitalize">
                        {profile.first_name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Last Name
                    </label>
                    {editing ? (
                      <input
                        value={form.last_name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, last_name: e.target.value }))
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    ) : (
                      <p className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground capitalize">
                        {profile.last_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bio — textarea in edit mode, static paragraph in view mode */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Bio
                  </label>
                  {editing ? (
                    <textarea
                      value={form.bio}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, bio: e.target.value }))
                      }
                      rows={3}
                      maxLength={500}
                      placeholder="Tell us a bit about yourself…"
                      className="w-full px-3 py-2.5 rounded-lg border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                    />
                  ) : (
                    <p className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm min-h-[80px] text-foreground">
                      {profile.bio || (
                        <span className="text-muted-foreground italic">
                          No bio added yet.
                        </span>
                      )}
                    </p>
                  )}
                  {/* Character counter shown only while editing */}
                  {editing && (
                    <p className="text-xs text-muted-foreground mt-1 text-right">
                      {form.bio.length}/500
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
