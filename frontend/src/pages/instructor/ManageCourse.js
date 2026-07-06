// instructor/ManageCourse.js — Full course editor for a single course.

import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  X,
  Check,
  FileText,
  Video,
  HelpCircle,
  Upload,
  ImagePlus,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Star,
  MessageSquare,
  FileArchive,
} from "lucide-react";
import InstructorLayout from "@/components/InstructorLayout";
import { Button } from "@/components/ui/button";
import {
  getCourse,
  updateCourse,
  deleteCourse,
  publishCourse,
  unpublishCourse,
  uploadThumbnail,
  deleteCourseThumbnail,
  getModules,
  createModule,
  updateModule,
  deleteModule,
  getLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  uploadLessonFile,
  deleteLessonFile,
  reorderModules,
  reorderLessons,
} from "@/api/instructor";
import { fetchThumbnailUrl } from "@/api/courses";
import { getCourseReviews } from "@/api/reviews";
import { getQuiz, deleteQuiz } from "@/api/quiz";
import { cn } from "@/lib/utils";

// Capitalise the first character (titles are stored lowercase in the DB)
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Visual style for each lesson content type badge
const TYPE_STYLE = {
  pdf: { icon: FileText, cls: "text-rose-600 bg-rose-50 border-rose-200" },
  video: { icon: Video, cls: "text-blue-600 bg-blue-50 border-blue-200" },
  quiz: {
    icon: HelpCircle,
    cls: "text-amber-600 bg-amber-50 border-amber-200",
  },
  assignment: {
    icon: FileArchive,
    cls: "text-violet-600 bg-violet-50 border-violet-200",
  },
};

export default function ManageCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  // ── Course data ──────────────────────────────────────────────────────────
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // ── Thumbnail ────────────────────────────────────────────────────────────
  const [thumbnailSrc, setThumbnailSrc] = useState(null); // Blob object URL
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const thumbnailInputRef = useRef();

  // ── Inline edit (course fields) ──────────────────────────────────────────
  // editField: which field is currently being edited ("title" | "description" | "skills" | null)
  const [editField, setEditField] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSkills, setEditSkills] = useState([]);
  const editSkillInputRef = useRef();
  const [fieldSaving, setFieldSaving] = useState(false);

  // ── Publish / Delete ─────────────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Modules ──────────────────────────────────────────────────────────────
  // Each module object is augmented with: lessons[], expanded (boolean)
  const [modules, setModules] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(true);

  const [editingModuleId, setEditingModuleId] = useState(null);
  const [editModuleTitle, setEditModuleTitle] = useState("");

  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  // addingLessonInModule: module id that has the "add lesson" form open, or null
  const [addingLessonInModule, setAddingLessonInModule] = useState(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonType, setNewLessonType] = useState("video");

  const [editingLessonId, setEditingLessonId] = useState(null);
  const [editLessonTitle, setEditLessonTitle] = useState("");

  // Map of lessonId → hidden file input DOM refs (used to trigger file picker per lesson)
  const lessonFileRefs = useRef({});

  // ── Reviews ──────────────────────────────────────────────────────────────
  const [reviews, setReviews] = useState(null);

  // ── Load course ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const data = await getCourse(Number(courseId));
        setCourse(data);
        // Fetch the thumbnail blob if one is set (returns a Blob object URL)
        if (data.thumbnail_url) {
          fetchThumbnailUrl(data.id)
            .then(setThumbnailSrc)
            .catch(() => {});
        }
        // Fetch reviews in the background (non-fatal)
        getCourseReviews(data.id)
          .then(setReviews)
          .catch(() => {});
      } catch (err) {
        setPageError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  // ── Load modules + their lessons ─────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const mods = await getModules(Number(courseId));
        // Sort by order_index ascending so they appear in the instructor's intended order
        const sorted = [...mods].sort((a, b) => a.order_index - b.order_index);
        // For each module, also fetch its lessons (in parallel for speed)
        const withLessons = await Promise.all(
          sorted.map(async (m) => {
            const lessons = await getLessons(m.id).catch(() => []);
            return {
              ...m,
              lessons: [...lessons].sort(
                (a, b) => a.order_index - b.order_index,
              ),
              expanded: false,
            };
          }),
        );
        setModules(withLessons);
      } catch {
        // Non-fatal — the content section will show empty
      } finally {
        setModulesLoading(false);
      }
    }
    load();
  }, [courseId]);

  // ── Inline course field editing ──────────────────────────────────────────

  // Enter edit mode for a specific field and pre-fill the local state
  function startEdit(field) {
    setEditField(field);
    if (field === "title") setEditTitle(course.title);
    if (field === "description") setEditDescription(course.description);
    if (field === "skills") {
      setEditSkills(course.skills ?? []);
    }
  }

  // Save only the changed field to the backend
  async function saveField(field) {
    setFieldSaving(true);
    try {
      const payload =
        field === "title"
          ? { title: editTitle.trim().toLowerCase() }
          : field === "description"
            ? { description: editDescription.trim().toLowerCase() }
            : { skills: editSkills };
      const updated = await updateCourse(course.id, payload);
      setCourse(updated); // Replace the entire course object with the server response
      setEditField(null);
    } catch {
      // Keep the edit form open so the instructor can retry
    } finally {
      setFieldSaving(false);
    }
  }

  // Add a skill tag from the inline skill input (normalised to lowercase)
  function addEditSkill() {
    const val = editSkillInputRef.current?.value.trim().toLowerCase() ?? "";
    if (!val || editSkills.includes(val)) return;
    setEditSkills((prev) => [...prev, val]);
    editSkillInputRef.current.value = "";
  }

  // ── Thumbnail ────────────────────────────────────────────────────────────

  async function handleThumbnailChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setThumbnailBusy(true);
    try {
      await uploadThumbnail(course.id, file);
      // Create a local preview immediately instead of re-fetching from the server
      const url = URL.createObjectURL(file);
      if (thumbnailSrc) URL.revokeObjectURL(thumbnailSrc); // Free the old blob
      setThumbnailSrc(url);
      setCourse((c) => ({ ...c, thumbnail_url: "set" })); // Mark as having a thumbnail
    } catch {
      // Silently ignore — thumbnail upload failure is non-fatal
    } finally {
      setThumbnailBusy(false);
      thumbnailInputRef.current.value = ""; // Reset so the same file can be re-selected
    }
  }

  async function handleRemoveThumbnail() {
    setThumbnailBusy(true);
    try {
      await deleteCourseThumbnail(course.id);
      if (thumbnailSrc) URL.revokeObjectURL(thumbnailSrc);
      setThumbnailSrc(null);
      setCourse((c) => ({ ...c, thumbnail_url: null }));
    } catch {
    } finally {
      setThumbnailBusy(false);
    }
  }

  // ── Publish / Delete ─────────────────────────────────────────────────────

  async function handlePublishToggle() {
    setPublishing(true);
    setPublishError("");
    try {
      if (course.published) {
        await unpublishCourse(course.id);
        setCourse((c) => ({ ...c, published: false }));
      } else {
        await publishCourse(course.id);
        setCourse((c) => ({ ...c, published: true }));
      }
    } catch (err) {
      // Show publish errors only when trying to publish (backend returns validation details)
      if (!course.published) setPublishError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  async function handleDeleteCourse() {
    setDeleting(true);
    try {
      await deleteCourse(course.id);
      navigate("/instructor/courses");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  // ── Modules ──────────────────────────────────────────────────────────────

  // Toggle expand/collapse for a module row in the content tree
  function toggleModule(id) {
    setModules((ms) =>
      ms.map((m) => (m.id === id ? { ...m, expanded: !m.expanded } : m)),
    );
  }

  async function handleAddModule() {
    const title = newModuleTitle.trim().toLowerCase();
    if (!title) return;
    try {
      const mod = await createModule(Number(courseId), { title });
      setModules((ms) => [...ms, { ...mod, lessons: [], expanded: false }]);
      setNewModuleTitle("");
      setAddingModule(false);
    } catch {}
  }

  async function handleSaveModuleTitle(moduleId) {
    const title = editModuleTitle.trim().toLowerCase();
    if (!title) return;
    try {
      const updated = await updateModule(moduleId, { title });
      setModules((ms) =>
        ms.map((m) => (m.id === moduleId ? { ...m, title: updated.title } : m)),
      );
      setEditingModuleId(null);
    } catch {}
  }

  async function handleDeleteModule(moduleId) {
    try {
      await deleteModule(moduleId);
      setModules((ms) => ms.filter((m) => m.id !== moduleId));
    } catch {}
  }

  // Swap a module with its neighbour and persist the new order to the backend.
  // On failure the optimistic update is rolled back.
  async function handleMoveModule(moduleId, direction) {
    const idx = modules.findIndex((m) => m.id === moduleId);
    const toIdx = direction === "up" ? idx - 1 : idx + 1;
    if (toIdx < 0 || toIdx >= modules.length) return;

    // Build the new order_index values (1-based) for the reorder API
    const newOrder = modules.map((_, i) => {
      if (i === idx) return toIdx + 1;
      if (i === toIdx) return idx + 1;
      return i + 1;
    });

    const prev = modules; // Snapshot for rollback
    const reordered = [...modules];
    [reordered[idx], reordered[toIdx]] = [reordered[toIdx], reordered[idx]];
    setModules(reordered.map((m, i) => ({ ...m, order_index: i + 1 }))); // Optimistic update

    try {
      await reorderModules(Number(courseId), newOrder);
    } catch {
      setModules(prev); // Rollback on failure
    }
  }

  // Same pattern as handleMoveModule but operates within a module's lessons array
  async function handleMoveLesson(moduleId, lessonId, direction) {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    const lessons = mod.lessons;
    const idx = lessons.findIndex((l) => l.id === lessonId);
    const toIdx = direction === "up" ? idx - 1 : idx + 1;
    if (toIdx < 0 || toIdx >= lessons.length) return;

    const newOrder = lessons.map((_, i) => {
      if (i === idx) return toIdx + 1;
      if (i === toIdx) return idx + 1;
      return i + 1;
    });

    const prev = modules; // Snapshot for rollback
    const reordered = [...lessons];
    [reordered[idx], reordered[toIdx]] = [reordered[toIdx], reordered[idx]];
    const updatedLessons = reordered.map((l, i) => ({
      ...l,
      order_index: i + 1,
    }));
    setModules((ms) =>
      ms.map((m) =>
        m.id === moduleId ? { ...m, lessons: updatedLessons } : m,
      ),
    );

    try {
      await reorderLessons(moduleId, newOrder);
    } catch {
      setModules(prev);
    }
  }

  // ── Lessons ──────────────────────────────────────────────────────────────

  async function handleAddLesson(moduleId) {
    const title = newLessonTitle.trim().toLowerCase();
    if (!title) return;
    try {
      const lesson = await createLesson(moduleId, {
        title,
        content_type: newLessonType,
      });
      setModules((ms) =>
        ms.map((m) =>
          m.id === moduleId ? { ...m, lessons: [...m.lessons, lesson] } : m,
        ),
      );
      setNewLessonTitle("");
      setNewLessonType("video");
      setAddingLessonInModule(null);
    } catch {}
  }

  async function handleSaveLessonTitle(moduleId, lessonId) {
    const title = editLessonTitle.trim().toLowerCase();
    if (!title) return;
    try {
      const updated = await updateLesson(lessonId, { title });
      setModules((ms) =>
        ms.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                lessons: m.lessons.map((l) =>
                  l.id === lessonId ? { ...l, title: updated.title } : l,
                ),
              }
            : m,
        ),
      );
      setEditingLessonId(null);
    } catch {}
  }

  // Delete a lesson. For quiz lessons, also delete the quiz content first.
  async function handleDeleteLesson(moduleId, lessonId) {
    const lesson = modules
      .find((m) => m.id === moduleId)
      ?.lessons.find((l) => l.id === lessonId);
    if (lesson?.content_type === "quiz") {
      try {
        const quiz = await getQuiz(lessonId);
        await deleteQuiz(quiz.id);
      } catch {} // Quiz may not exist yet — that's fine
    }
    try {
      await deleteLesson(lessonId);
      setModules((ms) =>
        ms.map((m) =>
          m.id === moduleId
            ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }
            : m,
        ),
      );
    } catch {}
  }

  // Delete only the quiz content (questions + answers) without removing the lesson shell
  async function handleDeleteQuizContent(moduleId, lessonId) {
    try {
      const quiz = await getQuiz(lessonId);
      await deleteQuiz(quiz.id);
    } catch {}
  }

  // Upload a file for a non-quiz lesson and mark file_url as "set" in local state
  async function handleUploadLessonFile(moduleId, lessonId, file) {
    try {
      await uploadLessonFile(lessonId, file);
      setModules((ms) =>
        ms.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                lessons: m.lessons.map((l) =>
                  l.id === lessonId ? { ...l, file_url: "set" } : l,
                ),
              }
            : m,
        ),
      );
    } catch {}
  }

  async function handleDeleteLessonFile(moduleId, lessonId) {
    try {
      await deleteLessonFile(lessonId);
      setModules((ms) =>
        ms.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                lessons: m.lessons.map((l) =>
                  l.id === lessonId ? { ...l, file_url: null } : l,
                ),
              }
            : m,
        ),
      );
    } catch {}
  }

  // ── Render ───────────────────────────────────────────────────────────────

  // Full-page skeleton while the course data is loading
  if (loading) {
    return (
      <InstructorLayout>
        <div className="p-8 max-w-4xl mx-auto space-y-4">
          <div className="h-5 w-24 bg-secondary rounded animate-pulse" />
          <div className="bg-white rounded-xl border border-border overflow-hidden animate-pulse">
            <div className="h-52 bg-secondary" />
            <div className="p-6 space-y-4">
              <div className="h-6 w-1/3 bg-secondary rounded" />
              <div className="h-4 w-2/3 bg-secondary rounded" />
              <div className="h-4 w-1/4 bg-secondary rounded" />
            </div>
          </div>
        </div>
      </InstructorLayout>
    );
  }

  // Error state (e.g. course not found or no permission)
  if (pageError) {
    return (
      <InstructorLayout>
        <div className="p-8 text-center">
          <p className="text-destructive text-sm">{pageError}</p>
        </div>
      </InstructorLayout>
    );
  }

  // Total lesson count shown in the Course Content section header
  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);

  return (
    <InstructorLayout>
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        {/* Back link */}
        <button
          onClick={() => navigate("/instructor/courses")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← My Courses
        </button>

        {/* ── Course Info card ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {/* Thumbnail area */}
          <input
            ref={thumbnailInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleThumbnailChange}
          />
          <div className="relative w-full h-52 bg-secondary">
            {/* Loading overlay while uploading */}
            {thumbnailBusy && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                <span className="text-sm text-muted-foreground">Saving...</span>
              </div>
            )}
            {thumbnailSrc ? (
              <>
                <img
                  src={thumbnailSrc}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {/* Hover overlay reveals Change / Remove buttons */}
                <div className="absolute inset-0 bg-black/0 hover:bg-black/35 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                  <button
                    onClick={() => thumbnailInputRef.current.click()}
                    className="bg-white text-foreground text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    Change
                  </button>
                  <button
                    onClick={handleRemoveThumbnail}
                    className="bg-white text-destructive text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </>
            ) : (
              // Click anywhere on the placeholder to upload a thumbnail
              <button
                onClick={() => thumbnailInputRef.current.click()}
                className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
              >
                <ImagePlus className="w-8 h-8" />
                <span className="text-sm">Add thumbnail</span>
              </button>
            )}
          </div>

          <div className="p-6">
            {/* ── Status badge + Publish / Delete actions ───────────────── */}
            <div className="flex items-center justify-between mb-5">
              <span
                className={cn(
                  "text-xs font-medium rounded-full px-2.5 py-0.5 border",
                  course.published
                    ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                    : "text-muted-foreground bg-secondary border-border",
                )}
              >
                {course.published ? "Live" : "Draft"}
              </span>

              <div className="flex items-center gap-2">
                {/* Publish / Unpublish toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePublishToggle}
                  disabled={publishing}
                  className={
                    course.published
                      ? "border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
                      : "border-emerald-400 text-emerald-600 hover:bg-emerald-500 hover:text-white"
                  }
                >
                  {publishing
                    ? "..."
                    : course.published
                      ? "Unpublish"
                      : "Publish"}
                </Button>

                {/* Delete with inline confirmation (no modal) */}
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Are you sure?
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDeleteCourse}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting..." : "Yes, delete"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    className="border-destructive/30 text-destructive hover:bg-destructive hover:text-white"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete
                  </Button>
                )}
              </div>
            </div>

            {/* Publish validation errors (e.g. "needs at least one lesson") */}
            {publishError && !course.published && (
              <div className="mb-5 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs font-semibold text-amber-800 mb-2">
                  Course can't be published yet:
                </p>
                <ul className="space-y-1">
                  {publishError.split("\n").map((issue, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-amber-700"
                    >
                      <span className="mt-0.5 shrink-0">•</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Title (inline editable) ───────────────────────────────── */}
            <div className="mb-4">
              {editField === "title" ? (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <span
                      className={cn(
                        "text-xs",
                        editTitle.length > 60
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {editTitle.length}/60
                    </span>
                  </div>
                  <input
                    autoFocus
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={60}
                    className="w-full text-xl font-bold px-3 py-1.5 rounded-lg border border-primary bg-primary/5 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveField("title");
                      if (e.key === "Escape") setEditField(null);
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => saveField("title")}
                      disabled={fieldSaving || !editTitle.trim()}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditField(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // View mode — pencil icon appears on hover via CSS group
                <div className="group flex items-start gap-2">
                  <h1 className="text-xl font-bold text-foreground">
                    {capitalize(course.title)}
                  </h1>
                  <button
                    onClick={() => startEdit("title")}
                    className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-muted-foreground hover:text-primary"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* ── Description (inline editable) ─────────────────────────── */}
            <div className="mb-4">
              {editField === "description" ? (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <span
                      className={cn(
                        "text-xs",
                        editDescription.length > 250
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {editDescription.length}/250
                    </span>
                  </div>
                  <textarea
                    autoFocus
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    maxLength={250}
                    rows={3}
                    className="w-full px-3 py-1.5 rounded-lg border border-primary bg-primary/5 focus:outline-none resize-none text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditField(null);
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => saveField("description")}
                      disabled={fieldSaving || !editDescription.trim()}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditField(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-start gap-2">
                  <p className="text-sm text-muted-foreground">
                    {capitalize(course.description)}
                  </p>
                  <button
                    onClick={() => startEdit("description")}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-primary"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* ── Skills (inline editable tag list) ────────────────────── */}
            <div>
              {editField === "skills" ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      ref={editSkillInputRef}
                      autoFocus
                      type="text"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addEditSkill();
                        }
                        if (e.key === "Escape") setEditField(null);
                      }}
                      placeholder="Add a skill"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addEditSkill}
                    >
                      Add
                    </Button>
                  </div>
                  {/* Editable skill pills */}
                  <div className="flex flex-wrap gap-2 min-h-6">
                    {editSkills.map((s) => (
                      <span
                        key={s}
                        className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full"
                      >
                        {s}
                        <button
                          onClick={() =>
                            setEditSkills(editSkills.filter((x) => x !== s))
                          }
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => saveField("skills")}
                      disabled={fieldSaving}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditField(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // View mode — skill pill list with hover-reveal pencil
                <div className="group flex items-start gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(course.skills ?? []).length > 0 ? (
                      course.skills.map((s) => (
                        <span
                          key={s}
                          className="bg-secondary text-foreground text-xs font-medium px-2.5 py-0.5 rounded-full border border-border"
                        >
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No skills added
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => startEdit("skills")}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-primary"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Course Content card ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Course Content</h2>
            <span className="text-xs text-muted-foreground">
              {modules.length} module{modules.length !== 1 ? "s" : ""} ·{" "}
              {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
            </span>
          </div>

          {modulesLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-11 bg-secondary rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {modules.map((mod) => (
                <div key={mod.id}>
                  {/* ── Module row ──────────────────────────────────────── */}
                  <div className="flex items-center gap-2 px-5 py-3 hover:bg-secondary/20 transition-colors">
                    {/* Expand / collapse chevron */}
                    <button
                      onClick={() => toggleModule(mod.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      {mod.expanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    {/* Module title — editable inline */}
                    {editingModuleId === mod.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          autoFocus
                          type="text"
                          value={editModuleTitle}
                          onChange={(e) => setEditModuleTitle(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm rounded border border-primary bg-primary/5 focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleSaveModuleTitle(mod.id);
                            if (e.key === "Escape") setEditingModuleId(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveModuleTitle(mod.id)}
                          className="text-primary hover:text-primary/70"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingModuleId(null)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-1 group/mod min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                          {capitalize(mod.title)}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({mod.lessons.length})
                        </span>
                        <button
                          onClick={() => {
                            setEditingModuleId(mod.id);
                            setEditModuleTitle(mod.title);
                          }}
                          className="opacity-0 group-hover/mod:opacity-100 transition-opacity text-muted-foreground hover:text-primary shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Module action buttons: move up/down, add lesson, delete */}
                    <div className="flex items-center gap-1 ml-auto shrink-0">
                      <button
                        onClick={() => handleMoveModule(mod.id, "up")}
                        disabled={modules.indexOf(mod) === 0}
                        className="text-muted-foreground hover:text-primary p-1 rounded hover:bg-primary/5 transition-colors disabled:opacity-20 disabled:cursor-default"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveModule(mod.id, "down")}
                        disabled={modules.indexOf(mod) === modules.length - 1}
                        className="text-muted-foreground hover:text-primary p-1 rounded hover:bg-primary/5 transition-colors disabled:opacity-20 disabled:cursor-default"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      {/* Toggle the add-lesson form and also expand the module */}
                      <button
                        onClick={() => {
                          if (addingLessonInModule === mod.id) {
                            setAddingLessonInModule(null);
                          } else {
                            setAddingLessonInModule(mod.id);
                            setNewLessonTitle("");
                            setNewLessonType("video");
                            setModules((ms) =>
                              ms.map((m) =>
                                m.id === mod.id ? { ...m, expanded: true } : m,
                              ),
                            );
                          }
                        }}
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 px-2 py-1 rounded hover:bg-primary/5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Lesson
                      </button>
                      <button
                        onClick={() => handleDeleteModule(mod.id)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* ── Lessons (shown when module is expanded) ──────────── */}
                  {mod.expanded && (
                    <div className="bg-secondary/20 border-t border-border/60">
                      {mod.lessons.length === 0 &&
                        addingLessonInModule !== mod.id && (
                          <p className="text-xs text-muted-foreground px-14 py-3">
                            No lessons yet.
                          </p>
                        )}

                      {mod.lessons.map((lesson) => {
                        // Look up the icon and badge colour for this lesson type
                        const { icon: Icon, cls } =
                          TYPE_STYLE[lesson.content_type] ?? TYPE_STYLE.pdf;
                        return (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-3 px-14 py-2.5 border-b border-border/40 last:border-0 hover:bg-secondary/30 transition-colors group/lesson"
                          >
                            {/* Content-type badge (Video / PDF / Quiz) */}
                            <span
                              className={cn(
                                "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border shrink-0",
                                cls,
                              )}
                            >
                              <Icon className="w-3 h-3" />
                              {lesson.content_type}
                            </span>

                            {/* AI indexing status badge (only for pdf and video lessons) */}
                            {(lesson.content_type === "pdf" ||
                              lesson.content_type === "video") &&
                              (lesson.is_indexed ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 shrink-0">
                                  <Sparkles className="w-3 h-3" />
                                  AI Ready
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 shrink-0">
                                  <Sparkles className="w-3 h-3" />
                                  Not indexed
                                </span>
                              ))}

                            {/* Lesson title — inline editable */}
                            {editingLessonId === lesson.id ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  autoFocus
                                  type="text"
                                  value={editLessonTitle}
                                  onChange={(e) =>
                                    setEditLessonTitle(e.target.value)
                                  }
                                  className="flex-1 px-2 py-0.5 text-sm rounded border border-primary bg-primary/5 focus:outline-none"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      handleSaveLessonTitle(mod.id, lesson.id);
                                    if (e.key === "Escape")
                                      setEditingLessonId(null);
                                  }}
                                />
                                <button
                                  onClick={() =>
                                    handleSaveLessonTitle(mod.id, lesson.id)
                                  }
                                  className="text-primary hover:text-primary/70"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingLessonId(null)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-1 group/les min-w-0">
                                <span className="text-sm text-foreground truncate">
                                  {capitalize(lesson.title)}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingLessonId(lesson.id);
                                    setEditLessonTitle(lesson.title);
                                  }}
                                  className="opacity-0 group-hover/les:opacity-100 transition-opacity text-muted-foreground hover:text-primary shrink-0"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {/* ── Quiz-specific actions ─────────────────── */}
                            {lesson.content_type === "quiz" && (
                              <div className="opacity-0 group-hover/lesson:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/instructor/courses/${courseId}/lessons/${lesson.id}/quiz`,
                                    )
                                  }
                                  className="text-xs text-amber-600 hover:text-amber-700 px-2 py-0.5 rounded border border-amber-200 hover:bg-amber-50 transition-colors flex items-center gap-1"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                  Edit Quiz
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteQuizContent(mod.id, lesson.id)
                                  }
                                  className="text-xs text-muted-foreground hover:text-destructive px-2 py-0.5 rounded border border-border hover:border-destructive/40 hover:bg-destructive/5 transition-colors flex items-center gap-1"
                                  title="Delete quiz content"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Quiz
                                </button>
                              </div>
                            )}

                            {/* ── File actions for video / PDF / assignment lessons ─────── */}
                            {lesson.content_type !== "quiz" && (
                              <>
                                {/* Hidden file input scoped per lesson via ref map */}
                                <input
                                  ref={(el) => {
                                    if (el)
                                      lessonFileRefs.current[lesson.id] = el;
                                  }}
                                  type="file"
                                  accept={
                                    lesson.content_type === "pdf"
                                      ? ".pdf"
                                      : lesson.content_type === "assignment"
                                        ? ".zip"
                                        : "video/*"
                                  }
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file)
                                      handleUploadLessonFile(
                                        mod.id,
                                        lesson.id,
                                        file,
                                      );
                                    e.target.value = "";
                                  }}
                                />
                                <div className="opacity-0 group-hover/lesson:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                                  {lesson.file_url ? (
                                    // File exists — offer Replace and Remove
                                    <>
                                      <button
                                        onClick={() =>
                                          lessonFileRefs.current[
                                            lesson.id
                                          ]?.click()
                                        }
                                        className="text-xs text-muted-foreground hover:text-primary px-2 py-0.5 rounded hover:bg-primary/5 transition-colors flex items-center gap-1"
                                      >
                                        <Upload className="w-3 h-3" />
                                        Replace
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteLessonFile(
                                            mod.id,
                                            lesson.id,
                                          )
                                        }
                                        className="text-xs text-muted-foreground hover:text-destructive px-2 py-0.5 rounded hover:bg-destructive/5 transition-colors flex items-center gap-1"
                                      >
                                        <X className="w-3 h-3" />
                                        File
                                      </button>
                                    </>
                                  ) : (
                                    // No file yet — amber "Upload" button prompts action
                                    <button
                                      onClick={() =>
                                        lessonFileRefs.current[
                                          lesson.id
                                        ]?.click()
                                      }
                                      className="text-xs text-amber-600 hover:text-amber-700 px-2 py-0.5 rounded border border-amber-200 hover:bg-amber-50 transition-colors flex items-center gap-1"
                                    >
                                      <Upload className="w-3 h-3" />
                                      Upload
                                    </button>
                                  )}
                                </div>
                              </>
                            )}

                            {/* Reorder up / down arrows for lessons */}
                            <div className="opacity-0 group-hover/lesson:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={() =>
                                  handleMoveLesson(mod.id, lesson.id, "up")
                                }
                                disabled={mod.lessons.indexOf(lesson) === 0}
                                className="text-muted-foreground hover:text-primary p-1 rounded hover:bg-primary/5 transition-colors disabled:opacity-20 disabled:cursor-default"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() =>
                                  handleMoveLesson(mod.id, lesson.id, "down")
                                }
                                disabled={
                                  mod.lessons.indexOf(lesson) ===
                                  mod.lessons.length - 1
                                }
                                className="text-muted-foreground hover:text-primary p-1 rounded hover:bg-primary/5 transition-colors disabled:opacity-20 disabled:cursor-default"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Delete lesson */}
                            <button
                              onClick={() =>
                                handleDeleteLesson(mod.id, lesson.id)
                              }
                              className="opacity-0 group-hover/lesson:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/5 transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}

                      {/* Add lesson inline form */}
                      {addingLessonInModule === mod.id && (
                        <div className="flex items-center gap-2 px-14 py-3 border-t border-border/40">
                          {/* Content type selector */}
                          <select
                            value={newLessonType}
                            onChange={(e) => setNewLessonType(e.target.value)}
                            className="text-sm px-2 py-1.5 rounded-lg border border-border bg-white focus:outline-none focus:border-primary"
                          >
                            <option value="video">Video</option>
                            <option value="pdf">PDF</option>
                            <option value="quiz">Quiz</option>
                            <option value="assignment">Assignment</option>
                          </select>
                          <input
                            autoFocus
                            type="text"
                            value={newLessonTitle}
                            onChange={(e) => setNewLessonTitle(e.target.value)}
                            placeholder="Lesson title"
                            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddLesson(mod.id);
                              if (e.key === "Escape")
                                setAddingLessonInModule(null);
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleAddLesson(mod.id)}
                            disabled={!newLessonTitle.trim()}
                          >
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAddingLessonInModule(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Add module inline form / button */}
              {addingModule ? (
                <div className="flex items-center gap-2 px-5 py-3">
                  <input
                    autoFocus
                    type="text"
                    value={newModuleTitle}
                    onChange={(e) => setNewModuleTitle(e.target.value)}
                    placeholder="Module title"
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-secondary/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddModule();
                      if (e.key === "Escape") {
                        setAddingModule(false);
                        setNewModuleTitle("");
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddModule}
                    disabled={!newModuleTitle.trim()}
                  >
                    Add Module
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAddingModule(false);
                      setNewModuleTitle("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingModule(true)}
                  className="w-full flex items-center gap-2 px-5 py-3 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Module
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Student Reviews card ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Student Reviews</h2>
            </div>
            {/* Aggregate rating in the header when reviews exist */}
            {reviews && reviews.total_reviews > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={cn(
                        "w-4 h-4",
                        s <= Math.round(reviews.average_rating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/25",
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {reviews.average_rating.toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({reviews.total_reviews} review
                  {reviews.total_reviews !== 1 ? "s" : ""})
                </span>
              </div>
            )}
          </div>

          {/* Loading skeleton */}
          {!reviews ? (
            <div className="p-6 space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-secondary rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : reviews.total_reviews === 0 ? (
            // Empty state
            <div className="px-6 py-10 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            </div>
          ) : (
            // Individual review rows
            <div className="divide-y divide-border">
              {reviews.reviews.map((review) => (
                <div key={review.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Avatar initials circle */}
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {review.student_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {capitalize(review.student_name)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </p>
                      </div>
                    </div>
                    {/* Star rating for this review */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={cn(
                            "w-3.5 h-3.5",
                            s <= review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/25",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Optional review comment */}
                  {review.comment && (
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed pl-10">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </InstructorLayout>
  );
}
