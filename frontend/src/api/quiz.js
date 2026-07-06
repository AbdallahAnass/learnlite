// quiz.js — API calls for quiz CRUD, image uploads, submission, and results.
// Used by both instructors (build quizzes) and students (take quizzes).

import { apiFetch, BASE_URL } from "./client";
import { getToken } from "@/lib/auth";

// ── Internal helpers ──────────────────────────────────────────────────────────

// Fetch any image (question or answer) as a Blob object URL.
// Returns null if the image doesn't exist (404), so callers can skip rendering.
async function fetchImageBlob(path) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// DELETE helper for endpoints that return 204 No Content (not JSON).
async function apiDelete(path) {
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

// ── Quiz ──────────────────────────────────────────────────────────────────────

// Fetch the quiz for a lesson, including its questions and answers
export function getQuiz(lessonId) {
  return apiFetch(`/lessons/${lessonId}/quiz`);
}

// Create a new quiz for a lesson.
// data: { title }
export function createQuiz(lessonId, data) {
  return apiFetch(`/lessons/${lessonId}/quiz`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Update quiz metadata (currently only the title)
export function updateQuiz(quizId, data) {
  return apiFetch(`/quizzes/${quizId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Delete the entire quiz (all questions and answers cascade-deleted)
export function deleteQuiz(quizId) {
  return apiDelete(`/quizzes/${quizId}`);
}

// ── Questions ─────────────────────────────────────────────────────────────────

// Add a blank question to a quiz (text can be set later via updateQuestion)
// data: { text: null }
export function addQuestion(quizId, data) {
  return apiFetch(`/quizzes/${quizId}/questions`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Update question text
export function updateQuestion(questionId, data) {
  return apiFetch(`/questions/${questionId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Delete a question (cascades to its answers and images)
export function deleteQuestion(questionId) {
  return apiDelete(`/questions/${questionId}`);
}

// ── Answers ───────────────────────────────────────────────────────────────────

// Add an answer choice to a question.
// data: { text, is_correct: false }
export function addAnswer(questionId, data) {
  return apiFetch(`/questions/${questionId}/answers`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Update answer text or mark it correct/incorrect
export function updateAnswer(answerId, data) {
  return apiFetch(`/answers/${answerId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Delete an answer choice
export function deleteAnswer(answerId) {
  return apiDelete(`/answers/${answerId}`);
}

// ── Question images ───────────────────────────────────────────────────────────

// Upload an image for a question (multipart/form-data)
export async function uploadQuestionImage(questionId, file) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/questions/${questionId}/image`, {
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

// Fetch a question's image as an object URL (returns null if no image)
export function fetchQuestionImageBlob(questionId) {
  return fetchImageBlob(`/questions/${questionId}/image`);
}

// Remove the image from a question
export function deleteQuestionImage(questionId) {
  return apiFetch(`/questions/${questionId}/image`, { method: "DELETE" });
}

// ── Answer images ─────────────────────────────────────────────────────────────

// Upload an image for an answer choice (multipart/form-data)
export async function uploadAnswerImage(answerId, file) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/answers/${answerId}/image`, {
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

// Fetch an answer's image as an object URL (returns null if no image)
export function fetchAnswerImageBlob(answerId) {
  return fetchImageBlob(`/answers/${answerId}/image`);
}

// Remove the image from an answer choice
export function deleteAnswerImage(answerId) {
  return apiFetch(`/answers/${answerId}/image`, { method: "DELETE" });
}

// ── Submission ────────────────────────────────────────────────────────────────

// Submit a student's answers for scoring.
// answers: [{ question_id, answer_id }]
// Returns: { score, correct_count, total_questions, answers: [...] }
export function submitQuiz(quizId, answers) {
  return apiFetch(`/quizzes/${quizId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

// Retrieve the student's most recent result for a quiz (if already submitted)
export function getQuizResult(quizId) {
  return apiFetch(`/quizzes/${quizId}/result`);
}
