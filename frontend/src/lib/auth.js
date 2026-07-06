// auth.js — JWT token helpers stored in localStorage.
// The token is a standard JWT; user identity (id + role) is extracted from its payload.

// Persist the JWT access token so subsequent page loads stay authenticated
export function saveToken(token) {
  localStorage.setItem("token", token);
}

// Retrieve the stored JWT token, or null if the user is not logged in
export function getToken() {
  return localStorage.getItem("token");
}

// Clear the token on logout
export function removeToken() {
  localStorage.removeItem("token");
}

// Decode the JWT payload (base64) and return { id, role } without verifying the signature.
// Signature verification is the backend's responsibility; we only need the claims here.
export function getUser() {
  const token = getToken();
  if (!token) return null;
  try {
    // JWT structure: header.payload.signature — we only need the middle part
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { id: payload.user_id, role: payload.user_role };
  } catch {
    // Malformed token — treat as unauthenticated
    return null;
  }
}

// Quick boolean check: is a token present at all?
export function isLoggedIn() {
  return !!getToken();
}
