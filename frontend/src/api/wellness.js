// wellness.js — API calls for the AI wellness / mental-health companion.

import { apiFetch } from "./client";

// Fetch a motivational / wellness tip to display on the My Learning page.
// The backend generates this using an LLM call.
export function getWellnessAdvice() {
  return apiFetch("/wellness/advice");
}

// Send a user message to the wellness chatbot.
// message: string — the user's latest message
// history: [{ role, content }] — prior turns so the LLM maintains context
export function sendWellnessMessage(message, history) {
  return apiFetch("/wellness/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}
