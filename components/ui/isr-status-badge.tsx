"use client";

import { usePathname } from "next/navigation";
import React from "react";
import { cn } from "@/lib/utils";
import Tooltip from "../tooltip/tooltip";

type NextCacheState = "HIT" | "STALE" | "MISS" | "unknown";

function normalizeCacheState(value: string | null): NextCacheState {
  if (!value) return "unknown";
  const upper = value.toUpperCase();
  if (upper === "HIT" || upper === "STALE" || upper === "MISS") return upper;
  return "unknown";
}

function getCacheHeaderValue(headers: Headers): { name: string; value: string | null } {
  // Primary header emitted by Next.js ISR (varies by platform/version).
  const next = headers.get("x-nextjs-cache");
  if (next) return { name: "x-nextjs-cache", value: next };

  return { name: "x-nextjs-cache", value: null };
}

const copy: Record<NextCacheState, { label: string; detail?: string }> = {
  HIT: { label: "Live", detail: "cached" },
  STALE: { label: "Stale", detail: "revalidating…" },
  MISS: { label: "Generating", detail: "first render" },
  unknown: { label: "Unknown" },
};

const tooltipCopy: Record<NextCacheState, string> = {
  HIT: "Live",
  STALE: "Stale - Refresh for live updates",
  MISS: "Generating - Refresh for live updates",
  unknown: "Unknown",
};

function getStyle(state: NextCacheState, isLoading: boolean) {
  switch (state) {
    case "HIT":
      return "bg-green-500";
    case "STALE":
      return "bg-amber-300";
    case "MISS":
      return "bg-sky-300";
    default:
      return "bg-zinc-300";
  }
}

export default function IsrStatusBadge() {
  const enabled = process.env.NEXT_PUBLIC_SHOW_ISR_BADGE === "true";
  const pathname = usePathname();

  const [cacheState, setCacheState] = React.useState<NextCacheState>("unknown");
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    // Hide the dot on route change until we get the first response for the new page.
    setIsLoading(true);

    const check = async () => {
      try {
        const url = window.location.href;

        // Prefer HEAD (cheapest). Some setups may not support it, so fall back to GET.
        let res = await fetch(url, { method: "HEAD", cache: "no-store", redirect: "follow" });
        if (res.status === 405 || res.status === 501) {
          res = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow" });
        }

        const header = getCacheHeaderValue(res.headers);
        const state = normalizeCacheState(header.value);

        if (!cancelled) {
          setCacheState(state);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setCacheState("unknown");
          setIsLoading(false);
        }
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname]);

  if (!enabled) return null;

  if (isLoading) {
    return <span className="inline-block h-2 w-2 rounded-full bg-zinc-300 animate-pulse" aria-hidden="true" />;
  }

  return (
    <Tooltip text={tooltipCopy[cacheState]} showDelay={false} hideDelay={false} opaque={true}>
      <span className={cn("inline-block h-2 w-2 rounded-full", getStyle(cacheState, isLoading))} aria-label={tooltipCopy[cacheState]} />
    </Tooltip>
  );
}
