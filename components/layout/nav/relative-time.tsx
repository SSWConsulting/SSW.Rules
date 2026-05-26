"use client";

import { useEffect, useState } from "react";
import moment from "moment";

interface Props {
  buildTimestamp: number;
  buildDate?: string;
}

function formatRelative(deltaMs: number): string {
  const delta = Math.abs(deltaMs) / 1000;
  const days = Math.floor(delta / 86400);
  const hours = Math.floor((delta % 86400) / 3600);
  const minutes = Math.floor((delta % 3600) / 60);
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 1) return `${minutes} min ago`;
  return "1 min ago";
}

/**
 * Renders "X min/hour/day(s) ago" and ticks every 60s so the relative time
 * stays accurate even when the page HTML is cached. On hover it shows a
 * custom tooltip with the exact build date (UTC). Client-only — server
 * initially renders with delta=0 ("1 min ago") and the client immediately
 * recomputes on mount to avoid hydration mismatch.
 */
export function RelativeTime({ buildTimestamp, buildDate }: Props) {
  const [now, setNow] = useState<number>(buildTimestamp);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const tooltip = buildDate
    ? `Last deployed ${moment(buildDate).utc().format("D MMM YYYY [at] HH:mm UTC")}`
    : undefined;

  return (
    <span className="relative inline-block group cursor-help">
      {formatRelative(now - buildTimestamp)}
      {tooltip && (
        <span
          role="tooltip"
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 bg-white text-gray-900 text-[11px] leading-none rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 shadow-md z-10"
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}
