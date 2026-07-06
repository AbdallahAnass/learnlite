// instructor.js — API calls for instructor-only course management operations.
// Students use api/courses.js for read-only access.

import { apiFetch, BASE_URL } from "./client";
import { getToken } from "@/lib/auth";

// ── Instructor analytics ──────────────────────────────────────────────────────

// Fetch all courses created by a specific instructor (by their user ID)
export function getInstructorCourses(instructorId) {
  return apiFetch(`/instructor/${instructorId}/courses`);
}

// Fetch enrollment and completion statistics for a single course
export function getCourseAnalytics(courseId) {
  return apiFetch(`/instructor/courses/${courseId}/analytics`);
}

// Fetch attempt count, average score, and pass rate for a specific quiz
export function getQuizAnalytics(quizId) {
  return apiFetch(`/instructor/quizzes/${quizId}/analytics`);
}

// ── Course CRUD ───────────────────────────────────────────────────────────────

// Read a single course (same endpoint as public, but needs auth to see draft courses)
export function getCourse(courseId) {
  return apiFetch(`/courses/${courseId}`);
}

// Create a new course in draft state.
// data: { title, description, skills? }
export function createCourse(data) {
  return apiFetch("/courses/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Update course metadata (title, description, skills)
export function updateCourse(courseId, data) {
  return apiFetch(`/courses/${courseId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Permanently delete a course and all its content
export function deleteCourse(courseId) {
  return apiFetch(`/courses/${courseId}`, { method: "DELETE" });
}

// Publish the course so students can discover and enroll in it.
// Backend validates that the course has at least one module and lesson first.
export function publishCourse(courseId) {
  return apiFetch(`/courses/${courseId}/publish`, { method: "PUT" });
}

// Revert to draft (hides from students but doesn't delete anything)
export function unpublishCourse(courseId) {
  return apiFetch(`/courses/${courseId}/unpublish`, { method: "PUT" });
}

// Remove the course thumbnail image
export function deleteCourseThumbnail(courseId) {
  return apiFetch(`/courses/${courseId}/thumbnail`, { method: "DELETE" });
}

// ── Module CRUD ───────────────────────────────────────────────────────────────

// Fetch the ordered list of modules for a course
export function getModules(courseId) {
  return apiFetch(`/courses/${courseId}/modules`);
}

// Add a new module to a course
// data: { title }
export function createModule(courseId, data) {
  return apiFetch(`/courses/${courseId}/modules`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Rename a module
export function updateModule(moduleId, data) {
  return apiFetch(`/courses/modules/${moduleId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Delete a module and all its lessons
export function deleteModule(moduleId) {
  return apiFetch(`/courses/modules/${moduleId}`, { method: "DELETE" });
}

// ── Lesson CRUD ───────────────────────────────────────────────────────────────

// Fetch the ordered list of lessons inside a module
export function getLessons(moduleId) {
  return apiFetch(`/courses/modules/${moduleId}/lessons`);
}

// Add a new lesson to a module
// data: { title, content_type: "video" | "pdf" | "quiz" }
export function createLesson(moduleId, data) {
  return apiFetch(`/courses/modules/${moduleId}/lessons`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Rename a lesson
export function updateLesson(lessonId, data) {
  return apiFetch(`/courses/lessons/${lessonId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Delete a lesson (and its associated file if one was uploaded)
export function deleteLesson(lessonId) {
  return apiFetch(`/courses/lessons/${lessonId}`, { method: "DELETE" });
}

// Upload (or replace) the file for a lesson (video or PDF).
// Must be multipart/form-data, so we use raw fetch instead of apiFetch.
export async function uploadLessonFile(lessonId, file) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/courses/lessons/${lessonId}/upload`, {
    method: "PUT",
    // Let the browser set Content-Type with the correct multipart boundary
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed." }));
    throw new Error(err.detail || "Upload failed.");
  }
  return res.json();
}

// Remove the file attached to a lesson (leaves the lesson record intact)
export function deleteLessonFile(lessonId) {
  return apiFetch(`/courses/lessons/${lessonId}/file`, { method: "DELETE" });
}

// ── Reorder ───────────────────────────────────────────────────────────────────

// Reorder modules within a course.
// newOrder is an array of integers where newOrder[i] is the new order_index for the i-th module.
export function reorderModules(courseId, newOrder) {
  return apiFetch(`/courses/${courseId}/modules/reorder`, {
    method: "PUT",
    body: JSON.stringify(newOrder),
  });
}

// Reorder lessons within a module (same shape as reorderModules)
export function reorderLessons(moduleId, newOrder) {
  return apiFetch(`/courses/modules/${moduleId}/reorder`, {
    method: "PUT",
    body: JSON.stringify(newOrder),
  });
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

// Upload the course thumbnail image (multipart/form-data)
export async function uploadThumbnail(courseId, file) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/courses/${courseId}/thumbnail`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed." }));
    throw new Error(err.detail || "Upload failed.");
  }
  return res.json();
}
