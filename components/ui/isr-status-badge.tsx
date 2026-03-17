"use client";

import { usePathname } from "next/navigation";
import React from "react";
import { cn } from "@/lib/utils";
import Tooltip from "../tooltip/tooltip";

// x-nextjs-cache header values:
// - HIT: Served from cache (valid)
// - MISS: Just generated (fresh)
// - STALE: Serving old content while rebuilding
type CacheStatus = "live" | "stale" | "loading";

export default function IsrStatusBadge() {
  const pathname = usePathname();
  const [status, setStatus] = React.useState<CacheStatus>("loading");

  React.useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    const checkCache = async () => {
      try {
        const res = await fetch(window.location.href, {
          method: "HEAD",
          cache: "no-store",
        });

        const cacheHeader = res.headers.get("x-nextjs-cache")?.toUpperCase();

        if (cancelled) return;

        // HIT or MISS = Live (green), STALE = Stale (orange)
        if (cacheHeader === "STALE") {
          setStatus("stale");
        } else {
          setStatus("live");
        }
      } catch {
        if (!cancelled) setStatus("live"); // Default to live on error
      }
    };

    checkCache();
    return () => { cancelled = true; };
  }, [pathname]);

  if (status === "loading") {
    return <span className="inline-block h-2 w-2 rounded-full bg-zinc-300 animate-pulse" aria-hidden="true" />;
  }

  const isLive = status === "live";
  const tooltip = isLive ? "Live" : "Stale - Refresh for latest";
  const style = isLive ? "bg-green-500" : "bg-orange-500";

  return (
    <Tooltip text={tooltip} showDelay={false} hideDelay={false} opaque={true}>
      <span className={cn("inline-block h-2 w-2 rounded-full", style)} aria-label={tooltip} />
    </Tooltip>
  );
}
