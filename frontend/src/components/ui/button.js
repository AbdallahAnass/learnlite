// button.js — Reusable Button component built on top of class-variance-authority (cva).
// Supports multiple visual variants and sizes; mirrors the shadcn/ui button API.

import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Define all Tailwind class combinations for each variant + size combination.
// cva generates a function that picks the right classes based on props.
const buttonVariants = cva(
  // Base classes applied to every button regardless of variant or size
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground hover:bg-primary/90",       // Filled primary blue
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90", // Red danger button
        outline:     "border border-input bg-background hover:bg-accent hover:text-accent-foreground", // Bordered
        secondary:   "bg-secondary text-secondary-foreground hover:bg-secondary/80",  // Light grey fill
        ghost:       "hover:bg-accent hover:text-accent-foreground",                  // Transparent until hover
        link:        "text-primary underline-offset-4 hover:underline",               // Looks like a text link
      },
      size: {
        default: "h-10 px-4 py-2",
        sm:      "h-9 rounded-md px-3",
        lg:      "h-12 rounded-md px-8 text-base",
        icon:    "h-10 w-10",  // Square, for icon-only buttons
      },
    },
    // Applied when variant/size props are omitted
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// Button component — renders a <button> with the computed variant/size classes.
// Extra className and all other native button props (onClick, disabled, type, etc.) pass through.
function Button({ className, variant, size, ...props }) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
