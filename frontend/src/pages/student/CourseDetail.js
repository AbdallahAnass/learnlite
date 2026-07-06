// student/CourseDetail.js — Public-facing course detail page with enrollment, content

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  GraduationCap,
  Pencil,
  PlayCircle,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import StudentLayout from "@/components/StudentLayout";
import {
  getCourse,
  getCourseModules,
  getModuleLessons,
  getCourseReviews,
  fetchThumbnailUrl,
} from "@/api/courses";
import {
  getEnrollmentStatus,
  enrollInCourse,
  unenrollFromCourse,
} from "@/api/enrollment";
import {
  submitReview,
  updateReview,
  deleteReview,
  getMyReview,
} from "@/api/reviews";

// Read-only star rating; size prop switches between small (default) and large icon sizes.
function StarRating({ value, size = "sm" }) {
  const full = Math.round(value ?? 0);
  const cls = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${cls} ${i <= full ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

// Small icon used in module accordions to visually distinguish lesson types.
function LessonIcon({ type }) {
  if (type === "video")
    return (
      <PlayCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
    );
  return <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
}

// Collapsible accordion row for a single course module.
// Lessons are fetched lazily on first open — not pre-loaded with the page — so
// students browsing modules with many lessons don't wait for all of them up front.
function ModuleRow({ module }) {
  const [open, setOpen] = useState(false);
  const [lessons, setLessons] = useState(null); // null = not yet fetched

  function toggle() {
    setOpen((v) => !v);
    // Only fetch once — if lessons is already populated, just toggle the panel.
    if (!lessons) {
      getModuleLessons(module.id)
        .then(setLessons)
        .catch(() => setLessons([])); // On error show empty state rather than hanging
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Module header button — chevron indicates open/closed */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-secondary/50 transition-colors text-left"
      >
        <span className="font-medium text-sm text-foreground capitalize">
          {module.title}
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Lesson list — rendered only while the accordion is open */}
      {open && (
        <div className="border-t border-border divide-y divide-border bg-secondary/30">
          {lessons === null ? (
            // Loading state — animate-pulse flickers while lessons are being fetched
            <div className="px-4 py-3 text-xs text-muted-foreground animate-pulse">
              Loading…
            </div>
          ) : lessons.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              No lessons yet.
            </div>
          ) : (
            lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex items-center gap-2 px-5 py-2.5"
              >
                <LessonIcon type={lesson.content_type} />
                <span className="text-xs text-foreground capitalize">
                  {lesson.title}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Interactive 5-star picker for the review form.
// `hovered` state drives visual feedback while the user hovers before clicking.
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
        >
          {/* Fill stars up to the hovered value (preview) or the committed value */}
          <Star
            className={`w-6 h-6 transition-colors ${
              star <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// Review creation / editing form.
// `existingReview` is null when submitting a new review; truthy when editing.
// `onSaved` is called with the saved review object after a successful submit/update.
// `onDeleted` is called (no args) after the review is successfully deleted.
function ReviewForm({ courseId, existingReview, onSaved, onDeleted }) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!existingReview; // Determines button label and which API to call

  async function handleSubmit(e) {
    e.preventDefault();
    // Client-side rating guard — the star picker starts at 0 which is invalid
    if (!rating) {
      setError("Please select a star rating.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = isEdit
        ? await updateReview(existingReview.id, rating, comment)
        : await submitReview(courseId, rating, comment);
      onSaved(saved); // Notify parent to update myReview + refresh public reviews list
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteReview(existingReview.id);
      onDeleted(); // Notify parent to set myReview → null + refresh reviews list
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-border p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-foreground">
        {isEdit ? "Edit your review" : "Leave a review"}
      </h3>

      {/* Interactive star picker */}
      <StarPicker value={rating} onChange={setRating} />

      {/* Optional comment textarea */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your thoughts about this course (optional)"
        rows={3}
        className="w-full text-sm rounded-lg border border-border px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        {/* Submit / Update button */}
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saving ? "Saving…" : isEdit ? "Update" : "Submit"}
        </button>
        {/* Delete button — only shown when editing an existing review */}
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>
    </form>
  );
}

// Read-only review card displayed in the public reviews list.
// Derives avatar initials from the student's name stored on the review object.
function ReviewCard({ review }) {
  // Build up to 2-character initials from the student's display name
  const initials = (review.student_name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex gap-3 py-4 border-b border-border last:border-0">
      {/* Circular avatar with initials */}
      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-foreground capitalize">
            {review.student_name}
          </span>
          <StarRating value={review.rating} />
        </div>
        {review.comment && (
          <p className="text-sm text-muted-foreground">{review.comment}</p>
        )}
      </div>
    </div>
  );
}

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  // ── Page data state ────────────────────────────────────────────────────────
  const [course, setCourse] = useState(null); // Core course object (title, description, …)
  const [thumb, setThumb] = useState(null); // Object URL for the hero thumbnail
  const [modules, setModules] = useState([]); // Course modules for the content accordion
  const [reviews, setReviews] = useState(null); // { average_rating, total_reviews, reviews[] }
  const [enrollStatus, setEnrollStatus] = useState(null); // "active" | "completed" | other | null
  // undefined = still loading; null = no review exists; object = existing review
  const [myReview, setMyReview] = useState(undefined);
  const [loading, setLoading] = useState(true);

  // ── Action state ───────────────────────────────────────────────────────────
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [unenrolling, setUnenrolling] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────
  // All requests fire concurrently on mount. The page loading flag tracks only the
  // core course fetch — modules and reviews have their own null/loading states.
  useEffect(() => {
    setLoading(true);

    // Primary fetch — gate the loading spinner on this one
    getCourse(courseId)
      .then((c) => {
        setCourse(c);
        // Fetch thumbnail separately (binary Blob endpoint) after the course meta arrives
        fetchThumbnailUrl(courseId)
          .then(setThumb)
          .catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // These can all start in parallel — none depend on the course object
    getCourseModules(courseId)
      .then(setModules)
      .catch(() => {});
    getCourseReviews(courseId)
      .then(setReviews)
      .catch(() => {});
    getEnrollmentStatus(courseId)
      .then(setEnrollStatus)
      .catch(() => {});
    // `r ?? null` converts undefined (no review) to null to distinguish "no review" from
    // "still loading" (which is the initial `undefined` state).
    getMyReview(courseId)
      .then((r) => setMyReview(r ?? null))
      .catch(() => setMyReview(null));
  }, [courseId]);

  // ── Unenroll handler ───────────────────────────────────────────────────────
  async function handleUnenroll() {
    setUnenrolling(true);
    try {
      await unenrollFromCourse(courseId);
      setEnrollStatus("unenrolled");
      setMyReview(null); // Unenrolling removes the student's review capability
    } catch (err) {
      setEnrollError(err.message);
    } finally {
      setUnenrolling(false);
    }
  }

  // ── Review callbacks ───────────────────────────────────────────────────────
  // After a review is saved, update myReview and re-fetch the public list so the
  // aggregate rating (average + count) reflects the new/updated review immediately.
  function handleReviewSaved(saved) {
    setMyReview(saved);
    getCourseReviews(courseId)
      .then(setReviews)
      .catch(() => {});
  }

  function handleReviewDeleted() {
    setMyReview(null);
    getCourseReviews(courseId)
      .then(setReviews)
      .catch(() => {});
  }

  // ── Enroll handler ─────────────────────────────────────────────────────────
  async function handleEnroll() {
    setEnrolling(true);
    setEnrollError("");
    try {
      await enrollInCourse(courseId);
      setEnrollStatus("active"); // Immediately reflect enrollment in the UI
    } catch (err) {
      setEnrollError(err.message);
    } finally {
      setEnrolling(false);
    }
  }

  // A student is considered "enrolled" if their status is active OR already completed.
  // This affects which buttons appear in the enrollment card and whether the review form shows.
  const isEnrolled = enrollStatus === "active" || enrollStatus === "completed";

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <StudentLayout>
        <div className="max-w-5xl mx-auto px-6 py-10 animate-pulse">
          <div className="h-8 bg-muted rounded w-1/2 mb-4" />
          <div className="h-4 bg-muted rounded w-full mb-2" />
          <div className="h-4 bg-muted rounded w-3/4" />
        </div>
      </StudentLayout>
    );
  }

  // ── 404 state ──────────────────────────────────────────────────────────────
  if (!course) {
    return (
      <StudentLayout>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Course not found.</p>
        </div>
      </StudentLayout>
    );
  }

  const skills = course.skills ?? [];
  const avgRating = reviews?.average_rating ?? null;
  const totalReviews = reviews?.total_reviews ?? 0;

  return (
    <StudentLayout>
      {/* ── Hero banner (dark background) ─────────────────────────────────── */}
      <div className="bg-foreground text-background">
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col md:flex-row gap-8 items-start">
          {/* Left: course metadata */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight mb-3 capitalize">
              {course.title}
            </h1>
            <p className="text-sm text-background/70 mb-4 capitalize">
              {course.description}
            </p>

            {/* Skill tags */}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded-full bg-white/10 text-xs capitalize"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            {/* Aggregate rating — hidden when there are no reviews */}
            {avgRating !== null && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-400">
                  {avgRating.toFixed(1)}
                </span>
                <StarRating value={avgRating} size="lg" />
                <span className="text-sm text-background/60">
                  ({totalReviews} reviews)
                </span>
              </div>
            )}
          </div>

          {/* Right: course thumbnail (or placeholder icon on dark bg) */}
          <div className="w-full md:w-72 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-white/5 aspect-video flex items-center justify-center">
            {thumb ? (
              <img
                src={thumb}
                alt={course.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <GraduationCap className="w-12 h-12 text-white/20" />
            )}
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
        {/* ── Left column: course content + reviews ──────────────────────── */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Course content accordion */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">
              Course Content
            </h2>
            {modules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No modules available yet.
              </p>
            ) : (
              <div className="space-y-2">
                {modules.map((mod) => (
                  <ModuleRow key={mod.id} module={mod} />
                ))}
              </div>
            )}
          </section>

          {/* Student reviews section */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4">
              Student Reviews
            </h2>
            {reviews === null ? (
              // Reviews still loading
              <div className="h-16 bg-muted rounded animate-pulse" />
            ) : totalReviews === 0 ? (
              // "No reviews" message — only for non-enrolled visitors (enrolled students see the form)
              !isEnrolled && (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              )
            ) : (
              <>
                {/* Rating summary: big number + star row + histogram bars */}
                <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-border mb-4">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-foreground">
                      {avgRating.toFixed(1)}
                    </p>
                    <StarRating value={avgRating} size="lg" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalReviews} reviews
                    </p>
                  </div>
                  {/* Per-star breakdown histogram */}
                  <div className="flex-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = reviews.reviews.filter(
                        (r) => r.rating === star,
                      ).length;
                      const pct = totalReviews
                        ? Math.round((count / totalReviews) * 100)
                        : 0;
                      return (
                        <div
                          key={star}
                          className="flex items-center gap-2 mb-1"
                        >
                          <span className="text-xs w-3 text-muted-foreground">
                            {star}
                          </span>
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            {/* Bar width is the percentage of reviews at this star level */}
                            <div
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-6 text-right">
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Individual review cards */}
                <div className="bg-white rounded-xl border border-border px-4">
                  {reviews.reviews.map((r) => (
                    <ReviewCard key={r.id} review={r} />
                  ))}
                </div>
              </>
            )}

            {/* Review form — only shown to enrolled students; hidden until myReview resolves */}
            {/* myReview === undefined means still loading → don't show form yet */}
            {isEnrolled && myReview !== undefined && (
              <div className="mt-4">
                <ReviewForm
                  courseId={courseId}
                  existingReview={myReview} // null = new review; object = editing existing
                  onSaved={handleReviewSaved}
                  onDeleted={handleReviewDeleted}
                />
              </div>
            )}
          </section>
        </div>

        {/* ── Right column: sticky enrollment card ────────────────────────── */}
        <div className="w-full lg:w-72 shrink-0">
          {/* sticky top-24 keeps the card visible while scrolling the left column */}
          <div className="sticky top-24 bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
            {/* Contextual blurb under the card heading */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>
                {totalReviews > 0
                  ? `${totalReviews} student reviews`
                  : isEnrolled
                    ? "You're enrolled"
                    : "No reviews yet"}
              </span>
            </div>

            {/* Enrollment status drives which buttons are shown */}
            {enrollStatus === null ? (
              // Enrollment status still loading — show skeleton button
              <div className="h-10 bg-muted rounded animate-pulse" />
            ) : isEnrolled ? (
              <>
                {/* Label: Enrolled or Completed */}
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {enrollStatus === "completed" ? "Completed" : "Enrolled"}
                </div>
                {/* Navigate to the lesson viewer for this course */}
                <button
                  onClick={() => navigate(`/courses/${courseId}/learn`)}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Continue Learning
                </button>
                {/* Unenroll is only available while the course is still active (not completed) */}
                {enrollStatus !== "completed" && (
                  <button
                    onClick={handleUnenroll}
                    disabled={unenrolling}
                    className="w-full py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60 transition-colors"
                  >
                    {unenrolling ? "Unenrolling…" : "Unenroll"}
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Enroll error message (e.g. "Course is not published") */}
                {enrollError && (
                  <p className="text-xs text-destructive">{enrollError}</p>
                )}
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {enrolling ? "Enrolling…" : "Enroll Now"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
