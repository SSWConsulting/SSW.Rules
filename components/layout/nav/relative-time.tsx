"use client";

import { useEffect, useId, useState } from "react";

interface Props {
  buildTimestamp: number;
  buildDate?: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

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

function formatUtcDate(iso: string): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const day = d.getUTCDate();
  const month = MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} at ${hh}:${mm} UTC`;
}

/**
 * Renders "X min/hour/day(s) ago" and ticks every 60s so the relative time
 * stays accurate even when the page HTML is cached. On hover or keyboard
 * focus it shows a custom tooltip with the exact build date (UTC). Client-
 * only — server initially renders with delta=0 ("1 min ago") and the
 * client immediately recomputes on mount to avoid hydration mismatch.
 *
 * Accessibility: the wrapper is focusable when a tooltip is present so
 * keyboard users can reveal it, and the tooltip is linked via
 * `aria-describedby` so screen readers announce it after the visible time.
 */
export function RelativeTime({ buildTimestamp, buildDate }: Props) {
  const [now, setNow] = useState<number>(buildTimestamp);
  const tooltipId = useId();

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const formatted = buildDate ? formatUtcDate(buildDate) : undefined;
  const tooltip = formatted ? `Last updated ${formatted}` : undefined;

  return (
    <span
      className={`relative inline-block group text-white hover:text-ssw-red focus-visible:text-ssw-red transition-all duration-300 ease-in-out${tooltip ? " cursor-help" : ""}`}
      tabIndex={tooltip ? 0 : undefined}
      aria-describedby={tooltip ? tooltipId : undefined}
      title={tooltip}
    >
      {formatRelative(now - buildTimestamp)}
      {tooltip && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 bg-white text-gray-900 text-[11px] leading-none rounded whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 pointer-events-none transition-opacity duration-150 shadow-md z-10"
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}
