// admin/Courses.js — Course management page for administrators.

import { useEffect, useState } from "react";
import { BookOpen, EyeOff, Trash2 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { listAllCourses, unpublishCourse, deleteCourse } from "@/api/admin";

// Modal confirmation dialog shown before permanently deleting a course.
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-border p-6 w-full max-w-sm mx-4">
        <p className="text-sm text-foreground mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-white hover:bg-destructive/90 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCourses() {
  // courses: array of course objects; null while loading
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState("");
  // confirm: the course object pending deletion (null = dialog closed)
  const [confirm, setConfirm] = useState(null);
  // acting: id of the course currently being acted on (disables buttons for that row)
  const [acting, setActing] = useState(null);

  // Fetch all courses on mount
  useEffect(() => {
    listAllCourses()
      .then(setCourses)
      .catch((e) => setError(e.message));
  }, []);

  // Hide the course from students without deleting it
  async function handleUnpublish(course) {
    setActing(course.id);
    try {
      const updated = await unpublishCourse(course.id);
      // Update the published flag in local state so the badge reflects the change immediately
      setCourses((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, published: false } : c)),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setActing(null);
    }
  }

  // Permanently delete a course and all its content after the user confirms
  async function handleDelete(course) {
    setConfirm(null); // Close the dialog first
    setActing(course.id);
    try {
      await deleteCourse(course.id);
      // Remove from local state — no need for a full re-fetch
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setActing(null);
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all platform courses
          </p>
        </div>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        {/* Deletion confirmation dialog — portal-like fixed overlay */}
        {confirm && (
          <ConfirmDialog
            message={`Delete "${confirm.title}"? This will unenroll all students and cannot be undone.`}
            onConfirm={() => handleDelete(confirm)}
            onCancel={() => setConfirm(null)}
          />
        )}

        {/* ── Content states ─────────────────────────────────────────────── */}
        {courses === null ? (
          // Loading skeleton
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No courses found.</p>
          </div>
        ) : (
          // Course table
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Course
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Instructor
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3" /> {/* Actions column */}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {courses.map((course) => (
                  <tr
                    key={course.id}
                    className="hover:bg-secondary/30 transition-colors"
                  >
                    {/* Course title + first 3 skills as a subtitle */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground capitalize">
                        {course.title}
                      </p>
                      {course.skills?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {course.skills.slice(0, 3).join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {course.instructor_name}
                    </td>
                    {/* Published / Unpublished badge */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          course.published
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {course.published ? "Published" : "Unpublished"}
                      </span>
                    </td>
                    {/* Action buttons — only show Unpublish if currently published */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {course.published && (
                          <button
                            onClick={() => handleUnpublish(course)}
                            disabled={acting === course.id}
                            title="Unpublish"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 disabled:opacity-40 transition-colors"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        )}
                        {/* Delete button opens the confirmation dialog */}
                        <button
                          onClick={() => setConfirm(course)}
                          disabled={acting === course.id}
                          title="Delete"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
