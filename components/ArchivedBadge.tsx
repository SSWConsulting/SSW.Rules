import { cn } from "@/lib/utils";

export function ArchivedBadge({ className }: { className?: string }) {
  return <span className={cn("inline-block rounded bg-ssw-red font-medium text-white", className)}>Archived</span>;
}
