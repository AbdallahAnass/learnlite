// admin.js — API calls available only to administrator-role users.

import { apiFetch, BASE_URL } from "./client";
import { getToken } from "@/lib/auth";

// Fetch platform-wide statistics for the admin dashboard:
// total_students, total_instructors, total_courses, enrollments, quiz metrics
export function getStats() {
  return apiFetch("/admin/stats");
}

// Paginated list of all student accounts
export function listStudents(skip = 0, limit = 50) {
  return apiFetch(`/admin/students?skip=${skip}&limit=${limit}`);
}

// Paginated list of all instructor accounts
export function listInstructors(skip = 0, limit = 50) {
  return apiFetch(`/admin/instructors?skip=${skip}&limit=${limit}`);
}

// Paginated list of all courses (published and unpublished)
export function listAllCourses(skip = 0, limit = 50) {
  return apiFetch(`/admin/courses?skip=${skip}&limit=${limit}`);
}

// Force-unpublish a course (hides it from students without deleting it)
export function unpublishCourse(courseId) {
  return apiFetch(`/admin/courses/${courseId}/unpublish`, { method: "PUT" });
}

// Internal helper for DELETE requests that return 204 No Content (not JSON).
// apiFetch assumes JSON responses, so we need a separate raw fetch here.
async function adminDelete(path) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Delete failed." }));
    throw new Error(err.detail || "Delete failed.");
  }
}

// Permanently delete a student account and all associated data
export function deleteStudent(studentId) {
  return adminDelete(`/admin/students/${studentId}`);
}

// Permanently delete an instructor account and all their courses
export function deleteInstructor(instructorId) {
  return adminDelete(`/admin/instructors/${instructorId}`);
}

// Permanently delete a course (unenrolls all students)
export function deleteCourse(courseId) {
  return adminDelete(`/admin/courses/${courseId}`);
}
