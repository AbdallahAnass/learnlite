// instructor/MyCourses.js — Table view of all the instructor's courses.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, Settings } from "lucide-react";
import InstructorLayout from "@/components/InstructorLayout";
import { Button } from "@/components/ui/button";
import { getInstructorCourses, getCourseAnalytics } from "@/api/instructor";
import { getUser } from "@/lib/auth";

// Capitalise the first character of a string (titles are stored lowercase in the DB)
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Thin horizontal bar showing average lesson completion percentage for a course
function ProgressBar({ value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-secondary rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full"
          style={{ width: `${Math.round(value)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">
        {Math.round(value)}%
      </span>
    </div>
  );
}

export default function MyCourses() {
  const navigate = useNavigate();
  const user = getUser(); // Read instructor id from JWT payload

  const [courses, setCourses] = useState([]);
  // analyticsMap: { [courseId]: analyticsObject } — built after courses load
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getInstructorCourses(user.id);
        setCourses(data);

        // Fetch analytics for every course in parallel; failures are non-fatal
        const results = await Promise.all(
          data.map((c) => getCourseAnalytics(c.id).catch(() => null)),
        );
        // Build { courseId → analyticsObj } lookup map
        const map = {};
        data.forEach((c, i) => {
          if (results[i]) map[c.id] = results[i];
        });
        setAnalytics(map);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id]);

  return (
    <InstructorLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Courses</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage and track all your courses
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

        {/* ── Course table card ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {/* Loading skeleton — one row per placeholder */}
          {loading && (
            <div className="divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-6 py-4 animate-pulse"
                >
                  <div className="w-14 h-10 bg-secondary rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-secondary rounded w-1/3" />
                    <div className="h-3 bg-secondary rounded w-1/2" />
                  </div>
                  <div className="h-5 w-14 bg-secondary rounded-full" />
                  <div className="h-4 w-16 bg-secondary rounded" />
                  <div className="w-32 h-3 bg-secondary rounded" />
                  <div className="h-8 w-20 bg-secondary rounded-lg" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="p-12 text-center">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {/* Empty state for first-time instructors */}
          {!loading && !error && courses.length === 0 && (
            <div className="p-12 text-center">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
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

          {/* Courses table */}
          {!loading && !error && courses.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Course
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Students
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-40">
                    Avg. Completion
                  </th>
                  <th className="px-6 py-3" /> {/* Manage action column */}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {courses.map((course) => {
                  const a = analytics[course.id];
                  const completion = a?.avg_completion_percentage ?? 0;

                  return (
                    <tr
                      key={course.id}
                      className="hover:bg-secondary/30 transition-colors"
                    >
                      {/* Course title + truncated description */}
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground leading-snug">
                          {capitalize(course.title)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {capitalize(course.description)}
                        </p>
                      </td>

                      {/* Published / Draft badge */}
                      <td className="px-4 py-4">
                        {course.published ? (
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                            Live
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground bg-secondary border border-border rounded-full px-2.5 py-0.5">
                            Draft
                          </span>
                        )}
                      </td>

                      {/* Total enrolled student count */}
                      <td className="px-4 py-4 text-right">
                        <span className="font-medium text-foreground">
                          {a?.total_enrolled ?? "—"}
                        </span>
                      </td>

                      {/* Progress bar + percentage label */}
                      <td className="px-4 py-4 w-40">
                        <ProgressBar value={completion} />
                      </td>

                      {/* Manage button navigates to the detailed course editor */}
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                          onClick={() =>
                            navigate(`/instructor/courses/${course.id}`)
                          }
                        >
                          <Settings className="w-3.5 h-3.5 mr-1.5" />
                          Manage
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </InstructorLayout>
  );
}
