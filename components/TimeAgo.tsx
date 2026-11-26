"use client";

import { useSyncExternalStore } from "react";
import { formatDateLong, parseDateInput, timeAgo } from "@/lib/dateUtils";

const subscribe = () => () => {};

/** False on the server and while React hydrates the server HTML, true after that. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

/**
 * Shows "3 days ago". The server cannot know when the page will be viewed (pages are cached for hours), and its time
 * zone is not the reader's, so the server HTML holds the UTC date. The browser shows the relative time after hydration.
 * A relative time in the server HTML causes React hydration error #418.
 */
export function TimeAgo({ date }: { date: string | null | undefined }) {
  const hydrated = useHydrated();
  if (!date) return null;

  const parsed = parseDateInput(date);
  if (Number.isNaN(parsed.getTime())) return null;

  return (
    <time dateTime={parsed.toISOString()} title={formatDateLong(date, "UTC")}>
      {hydrated ? timeAgo(date) : formatDateLong(date, "UTC")}
    </time>
  );
}
