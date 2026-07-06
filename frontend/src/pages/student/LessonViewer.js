// student/LessonViewer.js — Full-screen lesson viewer for enrolled students.

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  FileArchive,
  FileText,
  Loader2,
  PlayCircle,
  Send,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import {
  getCourse,
  getCourseModules,
  getModuleLessons,
  getLessonFileUrl,
  askCourse,
  getLessonSummary,
} from "@/api/courses";
import {
  getQuiz,
  submitQuiz,
  getQuizResult,
  fetchQuestionImageBlob,
  fetchAnswerImageBlob,
} from "@/api/quiz";
import { markLessonComplete, getCompletedLessons } from "@/api/enrollment";

// ─── Sidebar ─────────────────────────────────────────────────────────────────

// One module entry in the dark sidebar.
// Lessons are fetched once on first render (not on every open/close) and stored
// in local state for subsequent toggles.
// Auto-opens if the currently active lesson belongs to this module — this fires
// whenever `lessons` or `currentLessonId` change, so it keeps up as the student
// advances through the course.
function SidebarModule({ module, currentLessonId, completedIds, onSelect }) {
  const [open, setOpen] = useState(false);
  const [lessons, setLessons] = useState(null); // null = not yet fetched

  // Fetch lessons the first time this module is expanded
  useEffect(() => {
    getModuleLessons(module.id)
      .then(setLessons)
      .catch(() => setLessons([]));
  }, [module.id]);

  // Auto-expand if this module contains the current lesson
  useEffect(() => {
    if (lessons && lessons.some((l) => l.id === currentLessonId)) setOpen(true);
  }, [lessons, currentLessonId]);

  return (
    <div>
      {/* Module toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="text-xs font-semibold text-white/80 uppercase tracking-wide line-clamp-2 capitalize">
          {module.title}
        </span>
      </button>

      {/* Lesson list — collapsed/expanded via `open` */}
      {open && (
        <div className="pb-1">
          {lessons === null ? (
            // Skeleton while lessons are being fetched for the first time
            <div className="px-8 py-2 text-xs text-white/40 animate-pulse">
              Loading…
            </div>
          ) : (
            lessons.map((lesson) => {
              const active = lesson.id === currentLessonId; // Currently viewed lesson
              const done = completedIds.has(lesson.id); // Already completed
              // Icon differs by content type
              const Icon =
                lesson.content_type === "video"
                  ? PlayCircle
                  : lesson.content_type === "assignment"
                    ? FileArchive
                    : FileText;
              return (
                <button
                  key={lesson.id}
                  onClick={() => onSelect(lesson)}
                  className={`w-full flex items-center gap-2.5 px-8 py-2.5 text-left transition-colors ${
                    active
                      ? "bg-white/15 text-white" // Active: highlighted
                      : "text-white/60 hover:bg-white/5 hover:text-white/90" // Inactive: subtle
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs line-clamp-2 capitalize flex-1">
                    {lesson.title}
                  </span>
                  {/* Green checkmark for completed lessons */}
                  {done && (
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Quiz viewer ─────────────────────────────────────────────────────────────

// Interactive quiz renderer used when currentLesson.content_type === "quiz".
// Flow: load quiz → check for prior result → render questions → submit → show result.
// A score ≥ 70 is considered a pass and triggers the `onComplete` callback so the
// lesson can be marked complete in the parent's completedIds set.
function QuizViewer({ lessonId, onComplete }) {
  const [quiz, setQuiz] = useState(null);
  // Object URL maps for question and answer images (fetched as Blobs)
  const [qImages, setQImages] = useState({});
  const [aImages, setAImages] = useState({});
  // { questionId: answerId } — tracks which answer the student has selected per question
  const [selected, setSelected] = useState({});
  const [result, setResult] = useState(null); // Submitted quiz result (score, breakdown)
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Re-run whenever the lesson changes (student navigates to a different quiz lesson).
  useEffect(() => {
    // Reset all state so a stale quiz doesn't flash while the new one loads
    setQuiz(null);
    setResult(null);
    setSelected({});
    setError("");
    getQuiz(lessonId)
      .then(async (q) => {
        setQuiz(q);
        // Check if the student has already submitted this quiz — show result immediately if so
        getQuizResult(q.id)
          .then(setResult)
          .catch(() => {});
        // Fetch question and answer images in parallel (non-blocking — update state as they arrive)
        const qImgs = {};
        const aImgs = {};
        await Promise.all(
          q.questions.map(async (question) => {
            if (question.image_url) {
              fetchQuestionImageBlob(question.id)
                .then((url) => {
                  setQImages((prev) => ({ ...prev, [question.id]: url }));
                })
                .catch(() => {});
            }
            await Promise.all(
              question.answers.map(async (answer) => {
                if (answer.image_url) {
                  fetchAnswerImageBlob(answer.id)
                    .then((url) => {
                      setAImages((prev) => ({ ...prev, [answer.id]: url }));
                    })
                    .catch(() => {});
                }
              }),
            );
          }),
        );
      })
      .catch(() => setError("Could not load quiz."));
  }, [lessonId]);

  // Submit the student's selected answers.
  // Validates that all questions have been answered before sending.
  async function handleSubmit() {
    // Build the submission payload: array of { question_id, answer_id }
    const answers = Object.entries(selected).map(
      ([question_id, answer_id]) => ({
        question_id: Number(question_id),
        answer_id: Number(answer_id),
      }),
    );
    // Guard: require an answer for every question
    if (answers.length < quiz.questions.length) {
      setError("Please answer all questions before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await submitQuiz(quiz.id, answers);
      setResult(res);
      // ≥ 70% passes the quiz; notify the parent to mark the lesson complete
      if (res.score >= 70) onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Error state (only shown when the quiz itself failed to load)
  if (error && !quiz)
    return <p className="text-destructive text-sm p-6">{error}</p>;
  // Loading state — spinner while quiz is being fetched
  if (!quiz)
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );

  // ── Result screen ──────────────────────────────────────────────────────────
  if (result) {
    const passed = result.score >= 70;
    return (
      <div className="max-w-xl mx-auto py-12 px-6 text-center">
        {/* Trophy icon: amber if passed, grey if failed */}
        <Trophy
          className={`w-14 h-14 mx-auto mb-4 ${passed ? "text-amber-400" : "text-muted-foreground"}`}
        />
        <h2 className="text-xl font-bold mb-1">
          {passed ? "Passed!" : "Not quite."}
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          You scored{" "}
          <span className="font-semibold text-foreground">
            {result.score.toFixed(0)}%
          </span>{" "}
          ({result.correct_count}/{result.total_questions} correct)
        </p>

        {/* Per-question result breakdown */}
        <div className="text-left space-y-3 mb-8">
          {result.answers.map((a, i) => (
            <div
              key={a.question_id}
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                a.is_correct
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>
                Question {i + 1}: {a.is_correct ? "Correct" : "Incorrect"}
              </span>
            </div>
          ))}
        </div>

        {/* Failed: offer a retry; passed: no retry button needed */}
        {!passed && (
          <button
            onClick={() => {
              setResult(null);
              setSelected({});
            }}
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  // ── Quiz question list ─────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      <h2 className="text-lg font-bold mb-6">{quiz.title}</h2>
      <div className="space-y-8">
        {quiz.questions.map((q, qi) => (
          <div key={q.id}>
            {/* Question header: number + text + optional image */}
            <div className="flex gap-3 mb-3">
              <span className="text-sm font-semibold text-muted-foreground shrink-0">
                Q{qi + 1}.
              </span>
              <div>
                {q.text && (
                  <p className="text-sm font-medium text-foreground mb-2">
                    {q.text}
                  </p>
                )}
                {qImages[q.id] && (
                  <img
                    src={qImages[q.id]}
                    alt=""
                    className="max-h-48 rounded-lg mb-2 object-contain"
                  />
                )}
              </div>
            </div>

            {/* Answer options — radio inputs styled as full-width label blocks */}
            <div className="space-y-2 pl-6">
              {q.answers.map((ans) => {
                const checked = selected[q.id] === ans.id;
                return (
                  <label
                    key={ans.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? "border-primary bg-primary/5" // Selected answer
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    {/* Native radio; accent-primary colours the indicator */}
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={checked}
                      onChange={() =>
                        setSelected((prev) => ({ ...prev, [q.id]: ans.id }))
                      }
                      className="accent-primary"
                    />
                    <div className="flex items-center gap-2">
                      {/* Answer image thumbnail (if any) */}
                      {aImages[ans.id] && (
                        <img
                          src={aImages[ans.id]}
                          alt=""
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      {ans.text && <span className="text-sm">{ans.text}</span>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Validation error shown if the student tries to submit without answering all questions */}
      {error && <p className="text-destructive text-sm mt-4">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-8 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Submit Quiz
      </button>
    </div>
  );
}

// ─── AI Summary panel ─────────────────────────────────────────────────────────

// Splits a string on **bold** markers and returns an array of plain/bold React nodes.
function renderInline(str) {
  const parts = str.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
  );
}

// Renders a bulleted list from a multi-line AI summary string.
// Lines are split on newlines; leading list markers (-, *, •) are stripped.
function SummaryPanel({ text }) {
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <div className="shrink-0 border-t border-border bg-amber-50 px-6 py-4 overflow-y-auto max-h-64">
      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
        Lesson Summary
      </p>
      <ul className="space-y-1.5">
        {lines.map((line, i) => {
          // Strip leading bullet characters so we can render our own consistent dot
          const content = line.replace(/^[\s\-\*\•]+/, "").trim();
          return content ? (
            <li
              key={i}
              className="flex gap-2 text-sm text-foreground leading-relaxed"
            >
              <span className="text-amber-500 shrink-0 mt-0.5">•</span>
              <span>{renderInline(content)}</span>
            </li>
          ) : null;
        })}
      </ul>
    </div>
  );
}

// ─── Assignment viewer ────────────────────────────────────────────────────────

// Renders a download card for assignment lessons (zip files).
// Fetches the file as a blob so the download is authenticated, then offers it
// via a programmatic <a> click — the browser never auto-downloads on its own.
function AssignmentViewer({ lesson, alreadyCompleted, onComplete }) {
  const [fileData, setFileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [justMarked, setJustMarked] = useState(false);
  const prevIdRef = useRef(null);

  useEffect(() => {
    if (prevIdRef.current === lesson.id) return;
    prevIdRef.current = lesson.id;
    setFileData(null);
    setError("");
    setJustMarked(false);
    setLoading(true);
    getLessonFileUrl(lesson.id)
      .then(setFileData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [lesson.id]);

  const isCompleted = alreadyCompleted || justMarked;

  async function handleMarkComplete() {
    if (isCompleted) return;
    try {
      await markLessonComplete(lesson.id);
    } catch {
      /* 409 = already complete */
    }
    setJustMarked(true);
    onComplete();
  }

  // Derive the zip filename from the stored file_url path (e.g. "storage/.../assignment5.zip")
  const zipName = lesson.file_url
    ? lesson.file_url.split("/").pop()
    : "assignment.zip";

  function handleDownload() {
    if (!fileData) return;
    const a = document.createElement("a");
    a.href = fileData.url;
    a.download = zipName;
    a.click();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 flex items-center justify-center p-8">
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        ) : error ? (
          <p className="text-muted-foreground text-sm">{error}</p>
        ) : (
          <div className="flex flex-col items-center gap-6 max-w-sm w-full text-center">
            <h2 className="text-lg font-bold text-foreground capitalize">
              {lesson.title}
            </h2>
            {/* Clickable file card */}
            <button
              onClick={handleDownload}
              className="w-full flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-dashed border-violet-200 hover:border-violet-400 hover:bg-violet-50 transition-colors group"
            >
              <div className="w-16 h-16 rounded-2xl bg-violet-100 group-hover:bg-violet-200 flex items-center justify-center transition-colors">
                <FileArchive className="w-8 h-8 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground break-all">
                  {zipName}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click to download
                </p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Bottom bar: same layout as FileViewer but without AI controls */}
      <div className="shrink-0 px-6 py-3 border-t border-border flex items-center justify-between bg-white gap-3">
        <h2 className="text-sm font-semibold text-foreground capitalize truncate">
          {lesson.title}
        </h2>
        <button
          onClick={handleMarkComplete}
          disabled={isCompleted}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isCompleted
              ? "bg-emerald-50 text-emerald-700 cursor-default"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          {isCompleted ? "Completed" : "Mark as Complete"}
        </button>
      </div>
    </div>
  );
}

// ─── File viewer (video / pdf) ─────────────────────────────────────────────────

// Renders the lesson media: <video> for video lessons, <iframe> for PDF/text lessons.
// Also handles "Mark as Complete" and the AI Summarize feature.
//
// The `prevIdRef` guard prevents the expensive reset + re-fetch from running on
// re-renders that don't change the lesson ID (e.g. parent state updates).
function FileViewer({ lesson, alreadyCompleted, onComplete }) {
  // fileData: { url } returned by getLessonFileUrl (object URL or signed URL)
  const [fileData, setFileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // justMarked tracks whether the student clicked "Mark as Complete" this session
  // (separate from alreadyCompleted which came from the server on mount)
  const [justMarked, setJustMarked] = useState(false);
  const [summary, setSummary] = useState(null); // AI summary text, or null
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [showSummary, setShowSummary] = useState(false); // Toggle the SummaryPanel visibility
  const prevIdRef = useRef(null); // Stores the lesson ID from the previous render

  // Reset and re-fetch only when the lesson ID changes
  useEffect(() => {
    if (prevIdRef.current === lesson.id) return; // Same lesson — nothing to do
    prevIdRef.current = lesson.id;
    // Reset all lesson-specific state before loading the new lesson
    setFileData(null);
    setError("");
    setJustMarked(false);
    setLoading(true);
    setSummary(null);
    setSummaryError("");
    setShowSummary(false);
    getLessonFileUrl(lesson.id)
      .then(setFileData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [lesson.id]);

  // Fetch the AI summary on first click, then toggle visibility on subsequent clicks.
  async function handleSummarize() {
    if (summary) {
      setShowSummary((v) => !v);
      return;
    } // Already fetched — just toggle
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const data = await getLessonSummary(lesson.id);
      setSummary(data.summary);
      setShowSummary(true);
    } catch (err) {
      setSummaryError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  }

  // The lesson is considered complete if the server said so (alreadyCompleted) OR
  // if the student clicked "Mark as Complete" this session (justMarked).
  const isCompleted = alreadyCompleted || justMarked;

  // Mark the current lesson complete — fires the API, updates local state, and calls
  // the parent callback to add this lessonId to completedIds.
  // The backend may return 409 if the lesson was already marked (race condition or
  // duplicate click) — that's fine, so we swallow the error.
  async function handleMarkComplete() {
    if (isCompleted) return; // Button is disabled, but guard defensively
    try {
      await markLessonComplete(lesson.id);
    } catch {
      /* 409 = already complete — ignore */
    }
    setJustMarked(true);
    onComplete(); // Notify parent to add lessonId to completedIds Set
  }

  // Loading spinner
  if (loading)
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );

  // Error message (e.g. no file uploaded for this lesson yet)
  if (error)
    return (
      <div className="flex items-center justify-center flex-1">
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Media player — fills remaining vertical space */}
      <div className="flex-1 min-h-0">
        {lesson.content_type === "video" ? (
          // key={lesson.id} forces React to unmount+remount the <video> when the
          // lesson changes so the browser releases the previous media source
          <video
            key={lesson.id}
            src={fileData.url}
            controls
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          // PDF / document viewer via iframe
          <iframe
            key={lesson.id}
            src={fileData.url}
            title={lesson.title}
            className="w-full h-full border-0"
          />
        )}
      </div>

      {/* AI summary panel — only rendered when showSummary is true */}
      {showSummary && summary && <SummaryPanel text={summary} />}

      {/* Bottom bar: lesson title, Summarize button, Mark as Complete button */}
      <div className="shrink-0 px-6 py-3 border-t border-border flex items-center justify-between bg-white gap-3">
        <h2 className="text-sm font-semibold text-foreground capitalize truncate">
          {lesson.title}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          {/* Summary fetch error appears inline */}
          {summaryError && (
            <span className="text-xs text-destructive">{summaryError}</span>
          )}
          {/* Summarize / Hide Summary toggle */}
          <button
            onClick={handleSummarize}
            disabled={summaryLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-colors disabled:opacity-60"
          >
            {summaryLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            )}
            {summaryLoading
              ? "Summarizing…"
              : showSummary
                ? "Hide Summary"
                : "Summarize"}
          </button>
          {/* Mark as Complete — becomes a static green badge after clicking */}
          <button
            onClick={handleMarkComplete}
            disabled={isCompleted}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isCompleted
                ? "bg-emerald-50 text-emerald-700 cursor-default" // Already done
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            {isCompleted ? "Completed" : "Mark as Complete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bold markdown renderer ───────────────────────────────────────────────────

// Parses **bold** markdown in AI chat messages and renders matching <strong> spans.
// Only handles the **bold** pattern — no other markdown is supported.
function MessageText({ text }) {
  // Split on **...** capture group to preserve delimiter tokens in the result array
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong> // Strip the ** delimiters
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// ─── AI Chat panel ────────────────────────────────────────────────────────────

// Full-screen chat overlay that replaces the lesson content when `chatOpen = true`.
// Sends questions to the RAG endpoint (askCourse) which queries ChromaDB for
// course-specific context before generating the response via Groq.
//
// The textarea auto-grows to fit its content via a scroll-height side effect.
// Enter sends; Shift+Enter inserts a newline.
function AiChat({ courseId, onClose }) {
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi! Ask me anything about this course." }, // Initial greeting
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // True while waiting for the AI response
  const bottomRef = useRef(null); // Scroll anchor at the bottom of the message list
  const inputRef = useRef(null); // Ref for the auto-growing textarea

  // Auto-scroll to the bottom whenever new messages are added
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-grow the textarea: reset height to "auto" so scrollHeight recalculates,
  // then set the explicit height to match the content
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [input]);

  // Send the user's message to the RAG API and append the AI response to the thread.
  async function handleSend() {
    const q = input.trim();
    if (!q || loading) return; // Prevent empty sends or duplicate sends while waiting
    setInput(""); // Clear input immediately for responsive feel
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setLoading(true);
    try {
      // askCourse performs RAG: embeds the question, searches ChromaDB, then calls Groq
      const { answer } = await askCourse(courseId, q);
      setMessages((prev) => [...prev, { role: "ai", text: answer }]);
    } catch (err) {
      // Show an error bubble in the chat thread rather than a separate error state
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Enter sends; Shift+Enter inserts a line break (standard chat behaviour)
  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full bg-secondary/30">
      {/* Chat header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Course Assistant
            </p>
            <p className="text-xs text-muted-foreground">
              Ask anything about this course
            </p>
          </div>
        </div>
        {/* "← Back to lesson" closes the chat and restores the lesson content */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to lesson
        </button>
      </div>

      {/* Message thread — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {/* AI avatar — only shown for assistant messages */}
            {msg.role === "ai" && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            {/* Message bubble — different shape/colour for user vs AI */}
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm" // User: right, primary bg
                  : "bg-white border border-border text-foreground rounded-bl-sm shadow-sm" // AI: left, white bg
              }`}
            >
              {/* Render **bold** markdown in AI messages */}
              <MessageText text={msg.text} />
            </div>
          </div>
        ))}
        {/* Typing indicator — three animated dots while waiting for the AI response */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-white border border-border px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1.5 items-center">
              {/* Staggered bounce animation via Tailwind arbitrary delay */}
              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        {/* Invisible anchor div — scrolled into view on each new message */}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 bg-white border-t border-border px-6 py-4">
        <div className="flex gap-3 items-end bg-secondary rounded-xl px-4 py-3">
          {/* Auto-growing textarea */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask a question about this course…"
            rows={1}
            className="flex-1 resize-none text-sm bg-transparent outline-none leading-snug overflow-hidden"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function LessonViewer() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  // ── Page state ─────────────────────────────────────────────────────────────
  const [course, setCourse] = useState(null); // Course metadata (title)
  const [modules, setModules] = useState([]); // Ordered module list for the sidebar
  // Flat ordered list of all lessons across all modules — used for prev/next navigation
  const [allLessons, setAllLessons] = useState([]);
  const [currentLesson, setCurrentLesson] = useState(null); // The lesson currently being viewed
  // Set<lessonId> — populated from the server; updated optimistically on mark-complete
  const [completedIds, setCompletedIds] = useState(new Set());
  const [chatOpen, setChatOpen] = useState(false); // true = AI chat overlay replaces lesson content

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    // Non-blocking course title fetch for the sidebar header
    getCourse(courseId)
      .then(setCourse)
      .catch(() => {});
    // Pre-load the completed lesson IDs so the sidebar checkmarks are correct from the start
    getCompletedLessons(courseId)
      .then((ids) => setCompletedIds(new Set(ids)))
      .catch(() => {});
    // Fetch modules, then fetch all lesson lists in parallel and flatten them
    getCourseModules(courseId)
      .then(async (mods) => {
        setModules(mods);
        // Each module's lessons are fetched concurrently; errors produce an empty array
        const lessonArrays = await Promise.all(
          mods.map((m) => getModuleLessons(m.id).catch(() => [])),
        );
        // Flatten preserves the module order, giving a single navigable sequence
        const flat = lessonArrays.flat();
        setAllLessons(flat);
        // Auto-select the first lesson so the viewer isn't empty on initial load
        if (flat.length > 0) setCurrentLesson(flat[0]);
      })
      .catch(() => {});
  }, [courseId]);

  // Called by FileViewer and QuizViewer after a lesson is completed.
  // Adds the lessonId to the Set so the sidebar checkmark appears immediately.
  function handleComplete(lessonId) {
    setCompletedIds((prev) => new Set([...prev, lessonId]));
  }

  // ── Prev / Next navigation ──────────────────────────────────────────────────
  const currentIndex = allLessons.findIndex((l) => l.id === currentLesson?.id);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  return (
    // Full-viewport layout — no StudentLayout wrapper (custom full-screen experience)
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 bg-gray-900 flex flex-col overflow-hidden">
        {/* Back to course detail page */}
        <button
          onClick={() => navigate(`/courses/${courseId}`)}
          className="flex items-center gap-2 px-4 py-4 text-white/70 hover:text-white transition-colors border-b border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-medium">Back to Course</span>
        </button>

        {/* Course title (or "Loading…" before the course fetches) */}
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-xs font-bold text-white capitalize line-clamp-2">
            {course?.title ?? "Loading…"}
          </p>
        </div>

        {/* Scrollable module/lesson list */}
        <div className="flex-1 overflow-y-auto">
          {modules.map((mod) => (
            <SidebarModule
              key={mod.id}
              module={mod}
              currentLessonId={currentLesson?.id}
              completedIds={completedIds}
              onSelect={setCurrentLesson} // Switching lessons via the sidebar
            />
          ))}
        </div>
      </aside>

      {/* ── Main content area ────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {chatOpen ? (
          // AI Chat overlay replaces the lesson content entirely
          <AiChat courseId={courseId} onClose={() => setChatOpen(false)} />
        ) : (
          <>
            {/* Lesson content — spinner / QuizViewer / FileViewer based on lesson type */}
            {!currentLesson ? (
              // Still loading the first lesson
              <div className="flex items-center justify-center flex-1">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : currentLesson.content_type === "quiz" ? (
              // Quiz lesson — scrollable container to allow long quizzes
              <div className="flex-1 overflow-y-auto">
                <QuizViewer
                  lessonId={currentLesson.id}
                  onComplete={() => handleComplete(currentLesson.id)}
                />
              </div>
            ) : currentLesson.content_type === "assignment" ? (
              // Assignment lesson — zip download card
              <AssignmentViewer
                lesson={currentLesson}
                alreadyCompleted={completedIds.has(currentLesson.id)}
                onComplete={() => handleComplete(currentLesson.id)}
              />
            ) : (
              // Video or PDF lesson
              <FileViewer
                lesson={currentLesson}
                alreadyCompleted={completedIds.has(currentLesson.id)}
                onComplete={() => handleComplete(currentLesson.id)}
              />
            )}

            {/* ── Bottom navigation bar ─────────────────────────────────── */}
            {/* Only rendered when a lesson is selected */}
            {currentLesson && (
              <div className="shrink-0 border-t border-border bg-white px-4 py-3 flex items-center justify-between gap-3">
                {/* Previous lesson button — disabled on the first lesson */}
                <button
                  onClick={() => prevLesson && setCurrentLesson(prevLesson)}
                  disabled={!prevLesson}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {/* Title hidden on small screens to save space */}
                  <span className="hidden sm:inline capitalize line-clamp-1 max-w-32">
                    {prevLesson?.title ?? "Previous"}
                  </span>
                </button>

                {/* Center: lesson counter + Ask AI button */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {currentIndex + 1} / {allLessons.length}
                  </span>
                  {/* Opens the AiChat overlay */}
                  <button
                    onClick={() => setChatOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Bot className="w-4 h-4" />
                    <span className="hidden sm:inline">Ask AI</span>
                  </button>
                </div>

                {/* Next lesson button — disabled on the last lesson */}
                <button
                  onClick={() => nextLesson && setCurrentLesson(nextLesson)}
                  disabled={!nextLesson}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="hidden sm:inline capitalize line-clamp-1 max-w-32">
                    {nextLesson?.title ?? "Next"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
