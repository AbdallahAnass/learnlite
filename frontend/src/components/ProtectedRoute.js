// ProtectedRoute.js — Route guard that enforces authentication and role-based access.
// Usage:
//   <ProtectedRoute>            — any logged-in user
//   <ProtectedRoute role="student">  — only students
//   <ProtectedRoute role="instructor"> — only instructors
//   <ProtectedRoute role="administrator"> — only admins

import { Navigate } from "react-router-dom";
import { isLoggedIn, getUser } from "@/lib/auth";

export default function ProtectedRoute({ children, role }) {
  // Redirect to login if no JWT token is stored
  if (!isLoggedIn()) return <Navigate to="/login" replace />;

  // If a specific role is required, check the decoded JWT payload
  if (role) {
    const user = getUser();
    // Redirect to the landing page if the user's role doesn't match
    if (user?.role !== role) return <Navigate to="/" replace />;
  }

  // Access granted — render the wrapped page component
  return children;
}
