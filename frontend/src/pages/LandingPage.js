// LandingPage.js — Public marketing page shown to unauthenticated visitors.

import {
  Video,
  ClipboardList,
  TrendingUp,
  Sparkles,
  UserPlus,
  BookOpen,
  Award,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

// Feature cards shown in the "Why Learn With Us?" section
const features = [
  {
    icon: Video,
    title: "Video Lessons",
    description:
      "Watch structured video content at your own pace, with bookmark support to pick up right where you left off.",
  },
  {
    icon: ClipboardList,
    title: "Quizzes & Assessments",
    description:
      "Test your understanding with interactive quizzes and get instant feedback on every answer.",
  },
  {
    icon: TrendingUp,
    title: "Track Your Progress",
    description:
      "Monitor your learning journey with detailed progress tracking across all enrolled courses.",
  },
  {
    icon: Sparkles,
    title: "AI Assistant",
    description:
      "Ask anything about course content and get instant AI-powered answers tailored to your lessons.",
  },
];

// Step-by-step onboarding guide shown in the "How It Works" section
const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Create Your Account",
    description:
      "Sign up for free as a student or instructor in just a few seconds.",
  },
  {
    number: "02",
    icon: BookOpen,
    title: "Enroll in a Course",
    description:
      "Browse available courses and enroll in the ones that match your goals.",
  },
  {
    number: "03",
    icon: Award,
    title: "Learn & Grow",
    description:
      "Complete lessons, take quizzes, and track your progress to completion.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Public navbar with Log In / Get Started buttons */}
      <Navbar />

      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      {/* Background image with a primary-color overlay for readability */}
      <section
        className="relative text-white py-36 px-6 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero.png')" }}
      >
        {/* Semi-transparent blue overlay on top of the hero image */}
        <div className="absolute inset-0 bg-primary/85" />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h1 className="text-5xl font-extrabold mb-5 leading-tight tracking-tight">
            Learn Without Limits
          </h1>
          <p className="text-lg mb-10 opacity-85 max-w-xl mx-auto leading-relaxed">
            Gain real skills through structured courses, hands-on quizzes, and
            AI-powered guidance — all in one place.
          </p>
          {/* Two CTAs: primary (register) and secondary (login) */}
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              size="lg"
              className="bg-white text-primary hover:bg-gray-100 font-semibold shadow-md"
              onClick={() => navigate("/register")}
            >
              Get Started — it's free
            </Button>
            <Button
              size="lg"
              className="bg-transparent border-2 border-white text-white hover:bg-white/10"
              onClick={() => navigate("/login")}
            >
              Log In
            </Button>
          </div>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              Why Learn With Us?
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Everything you need to grow your skills, all in one platform.
            </p>
          </div>
          {/* Responsive grid: 1 col → 2 col → 4 col */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="p-6 rounded-xl border border-border hover:shadow-md hover:border-primary/30 transition-all duration-200"
              >
                {/* Icon badge */}
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-secondary">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Start learning in three simple steps.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {steps.map(({ number, icon: Icon, title, description }) => (
              <div
                key={number}
                className="flex flex-col items-center text-center"
              >
                {/* Step circle with a small number badge in the top-right corner */}
                <div className="relative mb-5">
                  <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                    <Icon className="w-7 h-7" />
                  </div>
                  {/* Strip the leading zero from "01" → "1" for the badge */}
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-border text-xs font-bold text-primary flex items-center justify-center shadow-sm">
                    {number.replace("0", "")}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-[#001a3d] text-white py-10 px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-lg font-bold tracking-tight">LearnLite</span>
            <p className="text-white/50 text-sm mt-1">
              © 2026 LearnLite. All rights reserved.
            </p>
          </div>
          {/* Quick links for visitors who scroll to the footer */}
          <div className="flex gap-6 text-sm text-white/70">
            <a href="/login" className="hover:text-white transition-colors">
              Log In
            </a>
            <a href="/register" className="hover:text-white transition-colors">
              Get Started
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
