// student/WellnessChat.js — Full-page wellness chatbot for students.

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Heart } from "lucide-react";
import StudentLayout from "@/components/StudentLayout";
import { getWellnessAdvice, sendWellnessMessage } from "@/api/wellness";

// Individual message bubble.
// User messages are right-aligned with a primary background.
// Assistant messages are left-aligned with a heart avatar and a white card style.
function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Heart avatar — only shown for assistant messages, not user messages */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5">
          <Heart className="w-4 h-4 text-primary" />
        </div>
      )}
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm" // User: right, primary
            : "bg-white border border-border text-foreground rounded-bl-sm shadow-sm" // AI: left, white
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

// Animated typing indicator shown while the AI is generating its response.
// Matches the assistant bubble layout (heart avatar + card) so it blends in naturally.
function TypingIndicator() {
  return (
    <div className="flex items-start">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5">
        <Heart className="w-4 h-4 text-primary" />
      </div>
      <div className="bg-white border border-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        {/* Spinning loader as the typing indicator */}
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

export default function WellnessChat() {
  // messages: array of { role: "user" | "assistant", content: string }
  // Starts empty; the opening message is fetched and appended on mount.
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  // sending: true while waiting for either the initial advice or an AI reply
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null); // Scroll anchor below the message list
  const inputRef = useRef(null); // Ref for the auto-growing textarea

  // ── Auto-grow the textarea ─────────────────────────────────────────────────
  // Resets height to "auto" on each keystroke so scrollHeight recalculates correctly,
  // then sets it to the actual content height to grow the box without showing a scrollbar.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [input]);

  // ── Fetch initial wellness advice ──────────────────────────────────────────
  // Called once on mount. Sets `sending = true` so the typing indicator is shown
  // before the first message arrives. Falls back to a generic greeting on error.
  useEffect(() => {
    setSending(true);
    getWellnessAdvice()
      .then((data) =>
        setMessages([{ role: "assistant", content: data.advice }]),
      )
      .catch(() =>
        setMessages([
          {
            role: "assistant",
            content:
              "Hi! I'm your wellness companion. How are you feeling today?",
          },
        ]),
      )
      .finally(() => setSending(false));
  }, []);

  // ── Auto-scroll to bottom ──────────────────────────────────────────────────
  // Fires whenever `messages` or `sending` changes so both new messages and the
  // typing indicator remain visible without manual scrolling.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // ── Send a message ─────────────────────────────────────────────────────────
  // Appends the user's message immediately (optimistic), then awaits the AI reply.
  // The conversation history is captured from the current `messages` array before
  // the user message is added so it represents the prior context.
  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return; // Guard: no empty messages while already waiting

    const userMsg = { role: "user", content: text };
    // Snapshot the history BEFORE the new user message is appended.
    // The API expects history in { role, content } format.
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    // Optimistically add the user message and clear the input
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true); // Triggers the typing indicator

    try {
      // sendWellnessMessage receives the user's text + full prior history for LLM context
      const data = await sendWellnessMessage(text, history);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      // Show a fallback error message in the chat thread rather than a separate error state
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  // Enter sends the message; Shift+Enter allows a newline inside the textarea.
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <StudentLayout>
      {/* calc(100vh - 4rem) accounts for the StudentLayout sticky navbar height */}
      <div
        className="max-w-2xl mx-auto px-6 py-8 flex flex-col"
        style={{ height: "calc(100vh - 4rem)" }}
      >
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="mb-6 shrink-0">
          <div className="flex items-center gap-3">
            {/* Heart avatar */}
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Wellness Companion
              </h1>
              <p className="text-sm text-muted-foreground">
                Here to support your learning journey
              </p>
            </div>
          </div>
        </div>

        {/* ── Message thread ───────────────────────────────────────────────── */}
        {/* flex-1 + min-h-0 allows the thread to fill remaining space and scroll independently */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
          {/* Show typing indicator immediately when loading the opening message */}
          {messages.length === 0 && sending && <TypingIndicator />}

          {/* Render all messages as bubbles */}
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {/* Show typing indicator after the last message while waiting for an AI reply */}
          {messages.length > 0 && sending && <TypingIndicator />}

          {/* Invisible scroll anchor — scrollIntoView keeps this in view on each update */}
          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ────────────────────────────────────────────────────── */}
        <div className="shrink-0 pt-4 border-t border-border flex items-end gap-3">
          {/* Auto-growing textarea — rows={1} sets minimum height */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Share how you're feeling or ask anything…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 overflow-hidden"
          />
          {/* Send button — disabled when input is empty or a response is pending */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </StudentLayout>
  );
}
