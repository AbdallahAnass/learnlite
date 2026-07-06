// enrollment.js — API calls for student enrollment and progress tracking.

import { apiFetch } from "./client";

// Check the current student's enrollment status in a course.
// Returns: "active" | "completed" | "unenrolled" (or similar backend string)
export function getEnrollmentStatus(courseId) {
  return apiFetch(`/enrollment/enrollment-status/${courseId}`);
}

// Enroll the current student in a course (creates an active enrollment record)
export function enrollInCourse(courseId) {
  return apiFetch(`/enrollment/?course_id=${courseId}`, { method: "POST" });
}

// Fetch all courses the current student is enrolled in (active + completed)
export function getEnrolledCourses() {
  return apiFetch("/enrollment/enrolled-courses");
}

// Get overall progress percentage for a course (0–100)
export function getCourseProgress(courseId) {
  return apiFetch(`/enrollment/progress/${courseId}`);
}

// Mark a specific lesson as completed.
// The backend recalculates course completion after each call.
export function markLessonComplete(lessonId) {
  return apiFetch(`/enrollment/progress/${lessonId}`, { method: "POST" });
}

// Fetch the list of lesson IDs the current student has completed in a course.
// Used by LessonViewer to pre-populate the completed-lessons Set on load.
export function getCompletedLessons(courseId) {
  return apiFetch(`/enrollment/completed-lessons/${courseId}`);
}

// Remove the student's enrollment from a course (soft delete / unenroll)
export function unenrollFromCourse(courseId) {
  return apiFetch(`/enrollment/${courseId}`, { method: "DELETE" });
}
