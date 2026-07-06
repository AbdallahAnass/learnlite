// student/CourseCatalog.js — Public course browsing page for students.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star, BookOpen } from "lucide-react";
import StudentLayout from "@/components/StudentLayout";
import {
  listCourses,
  listSkills,
  searchCourses,
  fetchThumbnailUrl,
} from "@/api/courses";

// Read-only star rating display used inside course cards.
// `value` is the average rating (float); we round to the nearest whole star.
function StarRating({ value }) {
  const full = Math.round(value ?? 0);
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= full ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

// Individual course card — navigates to /courses/:id on click.
// Thumbnail is fetched as a binary Blob and converted to an object URL for display.
// An `active` flag prevents a stale setState call if the component unmounts while
// the fetch is in-flight (e.g. user navigates away quickly).
function CourseCard({ course }) {
  const navigate = useNavigate();
  const [thumb, setThumb] = useState(null); // Object URL for the thumbnail image, or null

  useEffect(() => {
    let active = true; // Guard against setting state after unmount
    fetchThumbnailUrl(course.id)
      .then((url) => {
        if (active) setThumb(url);
      })
      .catch(() => {}); // No thumbnail — fall back to the BookOpen icon placeholder
    return () => {
      active = false;
    }; // Cleanup: mark component as inactive
  }, [course.id]);

  const skills = course.skills ?? []; // Backend may omit skills array; default to empty

  return (
    <button
      onClick={() => navigate(`/courses/${course.id}`)}
      className="group flex flex-col bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow text-left overflow-hidden"
    >
      {/* Thumbnail area — 16:9 aspect ratio */}
      <div className="w-full aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {thumb ? (
          <img
            src={thumb}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          // Placeholder icon while thumbnail is loading or if the course has none
          <BookOpen className="w-10 h-10 text-muted-foreground/30" />
        )}
      </div>

      <div className="flex flex-col gap-2 p-4 flex-1">
        {/* Course title — text-primary on hover via the parent `group` class */}
        <h3 className="font-semibold text-foreground text-sm line-clamp-2 group-hover:text-primary transition-colors">
          {course.title.charAt(0).toUpperCase() + course.title.slice(1)}
        </h3>

        {course.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {course.description}
          </p>
        )}

        {/* Skills pills — show at most 3 to avoid overflow; "+N" badge for extras */}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto pt-2">
            {skills.slice(0, 3).map((s) => (
              <span
                key={s}
                className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
              >
                {s}
              </span>
            ))}
            {skills.length > 3 && (
              <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-xs">
                +{skills.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Star rating — only shown when avg_rating is present (backend returns null when no reviews) */}
        {course.avg_rating != null && (
          <div className="flex items-center gap-1.5 pt-1">
            <StarRating value={course.avg_rating} />
            <span className="text-xs text-muted-foreground">
              {Number(course.avg_rating).toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

// Loading skeleton — mirrors the CourseCard layout with pulsing grey blocks.
// `count` controls how many placeholder cards to render.
function SkeletonGrid({ count = 5 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-white overflow-hidden animate-pulse"
        >
          <div className="aspect-video bg-muted" />
          <div className="p-4 flex flex-col gap-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CourseCatalog() {
  const [courses, setCourses] = useState([]); // Current result set displayed in the grid
  const [skills, setSkills] = useState([]); // Skill pill options loaded once on mount
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(""); // Controlled search input value
  const [activeSkill, setActiveSkill] = useState("All"); // Currently selected skill filter pill

  // Stores the pending setTimeout id for the search debounce.
  // clearTimeout(debounceRef.current) cancels any in-flight timer before starting a new one.
  const debounceRef = useRef(null);

  // Fetch all available skills once on mount for the filter pill row.
  useEffect(() => {
    listSkills()
      .then(setSkills)
      .catch(() => {}); // Non-fatal — pills just won't appear
  }, []);

  // Shared helper that triggers a listCourses fetch and manages loading/error state.
  // `params` is forwarded directly to the API (e.g. { limit: 5 } or { skill: "python" }).
  function load(params) {
    setLoading(true);
    setError("");
    listCourses(params)
      .then(setCourses)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  // Initial load: show 5 featured courses (backend picks the most relevant ones).
  useEffect(() => {
    load({ limit: 5 });
  }, []);

  // ── Skill filter handler ───────────────────────────────────────────────────
  // Clicking a skill pill:
  //   1. Updates the active pill.
  //   2. Clears the search input (search and skill filter are mutually exclusive).
  //   3. Cancels any pending debounced search.
  //   4. Loads courses filtered by the skill (or reloads the featured 5 for "All").
  function handleSkillClick(skillValue) {
    setActiveSkill(skillValue);
    setQuery("");
    clearTimeout(debounceRef.current);
    if (skillValue === "All") {
      load({ limit: 5 });
    } else {
      // When filtering by skill we want all matching courses, hence limit: 100
      load({ skill: skillValue, limit: 100 });
    }
  }

  // ── Search handler ─────────────────────────────────────────────────────────
  // Uses a 350 ms debounce so we don't fire a request on every keystroke.
  // Clearing the search field reverts to the default 5-featured view immediately
  // (no debounce needed — the state is already reset).
  function handleQueryChange(e) {
    const val = e.target.value;
    setQuery(val);
    setActiveSkill("All"); // Reset skill filter when the user starts typing
    clearTimeout(debounceRef.current); // Cancel previous debounce timer
    if (!val.trim()) {
      // Empty search — restore the featured courses immediately without waiting
      load({ limit: 5 });
      return;
    }
    // Schedule the actual search after 350 ms of inactivity
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError("");
      searchCourses(val.trim())
        .then(setCourses)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 350);
  }

  // Dynamic subtitle below the page heading — reflects the current filter/search state
  const subtitle =
    activeSkill !== "All"
      ? `Showing all "${activeSkill}" courses`
      : query
        ? `Results for "${query}"`
        : "Showing 5 featured courses";

  return (
    <StudentLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Page heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Browse Courses</h1>
          {/* Subtitle updates dynamically to tell the user what they're seeing */}
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>

        {/* ── Search bar ────────────────────────────────────────────────────── */}
        <div className="relative mb-5">
          {/* Search icon is absolutely positioned inside the input for visual alignment */}
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search courses..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* ── Skill filter pills ─────────────────────────────────────────────── */}
        {/* "All" is always the first pill; the rest come from the skills API */}
        <div className="flex flex-wrap gap-2 mb-8">
          {["All", ...skills].map((skill) => (
            <button
              key={skill}
              onClick={() => handleSkillClick(skill)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                activeSkill === skill
                  ? "bg-primary text-primary-foreground" // Active: filled primary
                  : "bg-white border border-border text-muted-foreground hover:bg-secondary" // Inactive: outlined
              }`}
            >
              {skill}
            </button>
          ))}
        </div>

        {/* ── Content states: loading → error → empty → grid ────────────────── */}
        {loading ? (
          <SkeletonGrid /> // Pulsing placeholders while data is fetching
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        ) : courses.length === 0 ? (
          // Empty state — shown when search or skill filter returns no results
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No courses found.</p>
          </div>
        ) : (
          // Responsive 4-column grid that collapses to 1 column on mobile
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
