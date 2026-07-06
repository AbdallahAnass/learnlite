// client.js — central HTTP helper for all API calls.
// All other api/*.js files import apiFetch from here so auth headers and
// error handling are applied consistently in one place.

import { getToken } from "@/lib/auth";

// Base URL for the FastAPI backend (running locally during development)
const BASE_URL = "http://localhost:8000";

export { BASE_URL };

// apiFetch wraps the native fetch API with:
//  1. Automatic JSON Content-Type header
//  2. Bearer token injection if the user is logged in
//  3. Uniform error extraction — FastAPI returns { detail: "..." } on errors
export async function apiFetch(path, options = {}) {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      // Only add the Authorization header when a token exists
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Allow callers to override or add extra headers (e.g. multipart uploads)
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    // FastAPI validation errors return an array of { msg } objects under detail;
    // plain errors return a string. Normalise both into a single message.
    const err = await res.json().catch(() => ({ detail: "Something went wrong." }));
    const detail = err.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg).join(", ")
      : detail || "Request failed.";
    throw new Error(message);
  }

  // Assume all successful responses are JSON
  return res.json();
}
