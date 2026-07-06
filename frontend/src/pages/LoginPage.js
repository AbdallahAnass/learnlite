// LoginPage.js — Two-panel login form.

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { login } from "@/api/auth";
import { saveToken, getUser } from "@/lib/auth";

// After login the user is sent to the correct home page for their role.
// Students go to /my-learning, instructors to /instructor/dashboard, admins to /admin/dashboard.
function redirectByRole(role, navigate) {
  if (role === "instructor") return navigate("/instructor/dashboard");
  if (role === "administrator") return navigate("/admin/dashboard");
  navigate("/my-learning"); // default for students
}

export default function LoginPage() {
  const navigate = useNavigate();

  // Controlled form state
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Update a single form field by name (works for any input with a name attribute)
  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // The login API returns { access_token, token_type }
      const data = await login(form);
      saveToken(data.access_token); // Persist JWT in localStorage
      const user = getUser(); // Decode role from the JWT payload
      redirectByRole(user?.role, navigate);
    } catch (err) {
      setError(err.message); // Display API error (e.g. "Invalid credentials")
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left decorative panel (hidden on small screens) ───────────── */}
      <div
        className="hidden md:flex flex-col justify-between w-5/12 text-primary-foreground p-12 relative bg-cover bg-center"
        style={{ backgroundImage: "url('/auth-bg.png')" }}
      >
        {/* Primary-color overlay for text legibility over the background image */}
        <div className="absolute inset-0 bg-primary/80" />

        {/* Brand logo at the top */}
        <Link
          to="/"
          className="relative z-10 text-2xl font-bold tracking-tight"
        >
          LearnLite
        </Link>
        {/* Marketing copy in the middle of the panel */}
        <div className="relative z-10">
          <h2 className="text-4xl font-extrabold leading-tight mb-4">
            Welcome back.
          </h2>
          <p className="opacity-75 text-lg leading-relaxed">
            Log in to continue your learning journey and pick up right where you
            left off.
          </p>
        </div>
        <p className="relative z-10 text-sm opacity-50">© 2026 LearnLite</p>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────── */}
      <div className="flex flex-col justify-center items-center flex-1 px-6 py-12 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile-only logo (replaces the hidden left panel on small screens) */}
          <Link
            to="/"
            className="md:hidden text-xl font-bold text-primary block mb-8"
          >
            LearnLite
          </Link>

          <h1 className="text-2xl font-bold text-foreground mb-1">
            Log in to your account
          </h1>
          <p className="text-muted-foreground text-sm mb-8">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-primary font-medium hover:underline"
            >
              Sign up
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="john@example.com"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Password field */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="Your password"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Inline API error message */}
            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Log In"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
