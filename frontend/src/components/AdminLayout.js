import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  GraduationCap,
  LogOut,
  UserCircle,
  Users,
} from "lucide-react";
import { removeToken } from "@/lib/auth";
import { logout } from "@/api/auth";
import { cn } from "@/lib/utils";

// Sidebar navigation links with their target route, icon, and display label
const navItems = [
  { to: "/admin/dashboard", icon: BarChart3, label: "Dashboard" },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/courses", icon: BookOpen, label: "Courses" },
  { to: "/profile", icon: UserCircle, label: "My Profile" },
];

export default function AdminLayout({ children }) {
  const navigate = useNavigate();

  // Call the backend logout endpoint (invalidates the token server-side),
  // then clear the local token and redirect to /login regardless of the API result.
  function handleLogout() {
    logout()
      .catch(() => {})
      .finally(() => {
        removeToken();
        navigate("/login");
      });
  }

  return (
    <div className="min-h-screen flex bg-secondary">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      {/* fixed + h-screen keeps the sidebar pinned while the main area scrolls */}
      <aside className="w-56 shrink-0 bg-white border-r border-border flex flex-col fixed top-0 left-0 h-screen z-40">
        {/* Brand logo row */}
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <GraduationCap className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-bold text-primary leading-none">
              LearnLite
            </p>
            <p className="text-xs text-muted-foreground">Admin Panel</p>
          </div>
        </div>

        {/* Navigation links — NavLink auto-applies isActive when the path matches */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary" // Active route highlight
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout button at the bottom of the sidebar */}
        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────────────────── */}
      {/* ml-56 offsets the content by the sidebar width so they don't overlap */}
      <div className="flex-1 min-w-0 flex flex-col ml-56">
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
