// instructor/Dashboard.js — Instructor home page.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Users,
  TrendingUp,
  Plus,
  BarChart2,
  Star,
} from "lucide-react";
import InstructorLayout from "@/components/InstructorLayout";
import { Button } from "@/components/ui/button";
import { getInstructorCourses, getCourseAnalytics } from "@/api/instructor";
import { getCourseReviews } from "@/api/reviews";
import { fetchThumbnailUrl } from "@/api/courses";
import { getUser } from "@/lib/auth";

// Capitalise the first character of a string (course titles are stored lowercase)
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Cycle through these colours for course cards that have no thumbnail
const placeholderColors = [
  "bg-blue-100 text-blue-600",
  "bg-violet-100 text-violet-600",
  "bg-emerald-100 text-emerald-600",
  "bg-amber-100 text-amber-600",
  "bg-rose-100 text-rose-600",
];

// Lazy-loads and displays the course thumbnail image.
// Falls back to a coloured placeholder icon if no thumbnail is set or fetch fails.
// Object URL is revoked on unmount to prevent memory leaks.
function CourseThumbnail({ courseId, hasThumbnail, id }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!hasThumbnail) return;
    let objectUrl;
    fetchThumbnailUrl(courseId)
      .then((url) => {
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => setSrc(null));
    // Cleanup: revoke the object URL so the browser releases the Blob from memory
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [courseId, hasThumbnail]);

  if (src) {
    return (
      <img src={src} alt="" className="w-full h-36 rounded-t-xl object-cover" />
    );
  }
  // Deterministic colour picked by course id so the same course always shows the same colour
  return (
    <div
      className={`w-full h-36 rounded-t-xl flex items-center justify-center ${placeholderColors[id % placeholderColors.length]}`}
    >
      <BookOpen className="w-10 h-10 opacity-60" />
    </div>
  );
}

// Summary stat card used in the top row (courses, students, avg. completion)
function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// Thin horizontal progress bar for average lesson completion percentage
function ProgressBar({ value }) {
  return (
    <div className="w-full bg-secondary rounded-full h-2">
      <div
        className="bg-primary h-2 rounded-full transition-all"
        style={{ width: `${Math.round(value)}%` }}
      />
    </div>
  );
}

// Five-star rating display with filled/empty star icons and numeric label
function StarRating({ rating, count }) {
  const filled = Math.round(rating);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-3.5 h-3.5 ${s <= filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-foreground">
        {rating.toFixed(1)}
      </span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
}

export default function InstructorDashboard() {
  const navigate = useNavigate();
  const user = getUser(); // Read instructor's id from the JWT payload

  const [courses, setCourses] = useState([]);
  // analyticsMap: { [courseId]: analyticsObject } — populated in parallel with the courses
  const [analytics, setAnalytics] = useState({});
  // ratingsMap: { [courseId]: reviewsObject }
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getInstructorCourses(user.id);
        setCourses(data);

        // Fetch analytics and reviews for all courses in parallel for speed
        const [analyticsResults, reviewResults] = await Promise.all([
          Promise.all(
            data.map((c) => getCourseAnalytics(c.id).catch(() => null)),
          ),
          Promise.all(
            data.map((c) => getCourseReviews(c.id).catch(() => null)),
          ),
        ]);

        // Build lookup maps keyed by course id for O(1) access in the render
        const analyticsMap = {};
        const ratingsMap = {};
        data.forEach((c, i) => {
          if (analyticsResults[i]) analyticsMap[c.id] = analyticsResults[i];
          if (reviewResults[i]) ratingsMap[c.id] = reviewResults[i];
        });

        setAnalytics(analyticsMap);
        setRatings(ratingsMap);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id]);

  // Aggregate stats derived from the analytics map
  const totalStudents = Object.values(analytics).reduce(
    (sum, a) => sum + (a?.total_enrolled ?? 0),
    0,
  );
  const avgCompletion =
    Object.values(analytics).length > 0
      ? Object.values(analytics).reduce(
          (sum, a) => sum + (a?.avg_completion_percentage ?? 0),
          0,
        ) / Object.values(analytics).length
      : 0;

  return (
    <InstructorLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Overview of your courses and students
            </p>
          </div>
          <Button
            onClick={() => navigate("/instructor/courses/new")}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Course
          </Button>
        </div>

        {/* ── Aggregate stat cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={BookOpen}
            label="Total Courses"
            value={courses.length}
          />
          <StatCard icon={Users} label="Total Students" value={totalStudents} />
          <StatCard
            icon={TrendingUp}
            label="Avg. Completion"
            value={`${Math.round(avgCompletion)}%`}
          />
        </div>

        {/* ── Courses section ───────────────────────────────────────────── */}
        <h2 className="text-lg font-semibold text-foreground mb-4">
          My Courses
        </h2>

        {/* Loading skeleton cards */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-border animate-pulse"
              >
                <div className="h-36 bg-secondary rounded-t-xl" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-secondary rounded w-full" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        {/* Empty state — first-time instructor with no courses yet */}
        {!loading && !error && courses.length === 0 && (
          <div className="bg-white rounded-xl border border-border p-12 text-center">
            <BarChart2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground mb-1">No courses yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first course to get started.
            </p>
            <Button onClick={() => navigate("/instructor/courses/new")}>
              <Plus className="w-4 h-4 mr-2" />
              Create Course
            </Button>
          </div>
        )}

        {/* Course cards grid */}
        {!loading && !error && courses.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course) => {
              const a = analytics[course.id]; // Analytics for this course
              const r = ratings[course.id]; // Reviews for this course
              const completion = a?.avg_completion_percentage ?? 0;
              const hasRating = r && r.total_reviews > 0;

              return (
                <div
                  key={course.id}
                  className="bg-white rounded-xl border border-border hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Thumbnail — image or coloured placeholder */}
                  <CourseThumbnail
                    courseId={course.id}
                    hasThumbnail={!!course.thumbnail_url}
                    id={course.id}
                  />

                  <div className="p-4 flex flex-col flex-1">
                    {/* Title + Live/Draft status badge */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-foreground leading-snug">
                        {capitalize(course.title)}
                      </h3>
                      {course.published ? (
                        <span className="shrink-0 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          Live
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs font-medium text-muted-foreground bg-secondary border border-border rounded-full px-2 py-0.5">
                          Draft
                        </span>
                      )}
                    </div>

                    {/* Course description */}
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {capitalize(course.description)}
                    </p>

                    {/* Star rating or "No reviews yet" placeholder */}
                    <div className="mb-4">
                      {hasRating ? (
                        <StarRating
                          rating={r.average_rating}
                          count={r.total_reviews}
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No reviews yet
                        </p>
                      )}
                    </div>

                    {/* Three enrollment metrics in a mini grid */}
                    <div className="grid grid-cols-3 gap-2 text-center mb-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {a?.total_enrolled ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Enrolled
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {a?.active_enrollments ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">Active</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {a?.completed_enrollments ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Completed
                        </p>
                      </div>
                    </div>

                    {/* Average completion progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Avg. completion</span>
                        <span>{Math.round(completion)}%</span>
                      </div>
                      <ProgressBar value={completion} />
                    </div>

                    {/* Navigate to the manage course page */}
                    <Button
                      variant="outline"
                      className="w-full mt-auto border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      onClick={() =>
                        navigate(`/instructor/courses/${course.id}`)
                      }
                    >
                      Manage
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </InstructorLayout>
  );
}
