import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Kept apart from ChatConversation so the search dialog, on every page, doesn't load the chat's markdown renderer.
export function RulekeeperMark({ size }: { size: "small" | "large" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-ssw-red to-ssw-dark-red text-white",
        size === "small" ? "size-8" : "size-14 shadow-md"
      )}
    >
      <Sparkles className={size === "small" ? "size-4" : "size-7"} />
    </span>
  );
}
