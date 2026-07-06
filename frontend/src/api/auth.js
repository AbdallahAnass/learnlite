// auth.js — API calls for authentication: register, login, logout.

import { apiFetch } from "./client";

// Register a new user (student or instructor).
// data: { first_name, last_name, email, password, role }
export function register(data) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Log in with email + password.
// The backend expects OAuth2 form-encoded body (username / password fields),
// not JSON, so we use URLSearchParams and override Content-Type.
export function login({ email, password }) {
  const body = new URLSearchParams({ username: email, password });
  return apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

// Invalidate the server-side session / token (backend deletes refresh token, etc.)
export function logout() {
  return apiFetch("/auth/logout", { method: "POST" });
}
