// Navbar.js — Public top navigation bar shown on the landing page and auth pages.
// Logged-in users never see this Navbar; they use their role-specific layout instead.

import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const navigate = useNavigate();

  return (
    // sticky + z-50 keeps the navbar above all page content while scrolling
    <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand logo — links back to the landing page */}
        <Link to="/" className="text-xl font-bold text-primary tracking-tight">
          LearnLite
        </Link>

        {/* CTA buttons */}
        <div className="flex items-center gap-3">
          {/* Ghost variant for secondary action */}
          <Button
            variant="ghost"
            className="text-foreground font-medium"
            onClick={() => navigate("/login")}
          >
            Log In
          </Button>
          {/* Primary filled button for the main CTA */}
          <Button onClick={() => navigate("/register")}>Get Started</Button>
        </div>
      </div>
    </nav>
  );
}
