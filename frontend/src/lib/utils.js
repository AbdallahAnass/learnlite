import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// cn — class name helper used throughout the UI.
// clsx builds a conditional class string, twMerge resolves Tailwind conflicts
// (e.g. two background-color utilities in the same string).
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
