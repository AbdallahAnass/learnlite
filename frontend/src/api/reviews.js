// reviews.js — API calls for student course reviews.

import { apiFetch, BASE_URL } from "./client";
import { getToken } from "@/lib/auth";

// Fetch all reviews for a course (returns { average_rating, total_reviews, reviews: [...] })
export function getCourseReviews(courseId) {
  return apiFetch(`/courses/${courseId}/reviews`);
}

// Fetch the current student's own review for a course, if one exists
export function getMyReview(courseId) {
  return apiFetch(`/courses/${courseId}/my-review`);
}

// Submit a new review for a course.
// comment is optional — pass undefined/empty string and it will be sent as null.
export function submitReview(courseId, rating, comment) {
  return apiFetch(`/courses/${courseId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating, comment: comment || null }),
  });
}

// Update an existing review (the student's own review by reviewId)
export function updateReview(reviewId, rating, comment) {
  return apiFetch(`/reviews/${reviewId}`, {
    method: "PUT",
    body: JSON.stringify({ rating, comment: comment || null }),
  });
}

// Delete the student's own review.
// Uses a raw fetch because DELETE endpoints return 204 No Content (not JSON).
export async function deleteReview(reviewId) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/reviews/${reviewId}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Delete failed." }));
    throw new Error(err.detail || "Delete failed.");
  }
}
