// courses.js — Public/student-facing API calls for courses and lessons.
// Instructors use api/instructor.js for write operations.

import { apiFetch, BASE_URL } from "./client";
import { getToken } from "@/lib/auth";

// Fetch a paginated list of published courses.
// Optionally filter by skill tag, or paginate with skip/limit.
export function listCourses({ skill, skip = 0, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (skill) params.set("skill", skill);
  params.set("skip", skip);
  params.set("limit", limit);
  return apiFetch(`/courses/?${params.toString()}`);
}

// Full-text search across course titles and descriptions
export function searchCourses(query) {
  return apiFetch(`/courses/search/${encodeURIComponent(query)}`);
}

// Get the distinct list of skill tags across all published courses (used for filter chips)
export function listSkills() {
  return apiFetch("/courses/skills");
}

// Fetch a single course by its ID (title, description, skills, thumbnail_url, etc.)
export function getCourse(courseId) {
  return apiFetch(`/courses/${courseId}`);
}

// Fetch the ordered list of modules for a course
export function getCourseModules(courseId) {
  return apiFetch(`/courses/${courseId}/modules`);
}

// Fetch the ordered list of lessons inside a specific module
export function getModuleLessons(moduleId) {
  return apiFetch(`/courses/modules/${moduleId}/lessons`);
}

// Fetch the aggregated review summary (average_rating, total_reviews, list of reviews)
export function getCourseReviews(courseId) {
  return apiFetch(`/courses/${courseId}/reviews`);
}

// Ask the AI assistant a question about a specific course.
// Uses RAG (ChromaDB + Groq) on the backend — requires course content to be indexed.
export function askCourse(courseId, question) {
  return apiFetch(`/courses/${courseId}/ask`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

// Stream the lesson file (video or PDF) as a Blob and return an object URL.
// We use a raw fetch (not apiFetch) because the response is binary, not JSON.
// The caller is responsible for revoking the returned object URL to avoid memory leaks.
export async function getLessonFileUrl(lessonId) {
  const token = (await import("@/lib/auth")).getToken();
  const res = await fetch(`${BASE_URL}/courses/lessons/${lessonId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("File not available.");
  const blob = await res.blob();
  // content-type tells FileViewer whether to render a <video> or <iframe>
  return { url: URL.createObjectURL(blob), type: res.headers.get("content-type") || "" };
}

// Request an AI-generated bullet-point summary for a lesson (video or PDF).
// The backend runs the summarizer lazily on first request and caches the result.
export function getLessonSummary(lessonId) {
  return apiFetch(`/courses/lessons/${lessonId}/summary`);
}

// Fetch a course thumbnail image as a Blob object URL.
// Used wherever the thumbnail must be displayed without an open <img src> URL.
export async function fetchThumbnailUrl(courseId) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/courses/${courseId}/thumbnail`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("no thumbnail");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
