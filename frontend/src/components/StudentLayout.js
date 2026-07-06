// StudentLayout.js — Shell layout for all student-facing pages.
// Uses a sticky top navbar instead of a sidebar (horizontal navigation pattern).

import { NavLink, useNavigate } from "react-router-dom";
import { BookOpen, GraduationCap, Library, LogOut, UserCircle } from "lucide-react";
import { removeToken } from "@/lib/auth";
import { logout } from "@/api/auth";
import { cn } from "@/lib/utils";

// Top navbar navigation links for students
const navItems = [
  { to: "/courses",      icon: BookOpen,    label: "Browse Courses" },
  { to: "/my-learning",  icon: Library,     label: "My Learning"    },
  { to: "/profile",      icon: UserCircle,  label: "My Profile"     },
];

export default function StudentLayout({ children }) {
  const navigate = useNavigate();

  // Logout: call backend first, then clear local token regardless of outcome
  function handleLogout() {
    logout().catch(() => {}).finally(() => {
      removeToken();
      navigate("/login");
    });
  }

  return (
    <div className="min-h-screen bg-secondary">
      {/* ── Top sticky navbar ─────────────────────────────────────────────── */}
      {/* sticky + z-50 keeps the bar above content cards when scrolling */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand logo */}
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold text-primary tracking-tight">LearnLite</span>
          </div>

          {/* Horizontal nav links — active link gets primary-tinted background */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Logout button — placed to the far right of the navbar */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </header>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <main>{children}</main>
    </div>
  );
}
