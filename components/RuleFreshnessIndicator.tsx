"use client";

import { useEffect, useState } from "react";
import Tooltip from "@/components/tooltip/tooltip";

type FreshnessStatus = "loading" | "fresh" | "stale" | "error";

interface RuleFreshnessIndicatorProps {
  relativePath: string;
  staticLastUpdated: string | null | undefined;
}

const STATUS_CONFIG: Record<Exclude<FreshnessStatus, "error">, { color: string; label: string; tooltip: string }> = {
  loading: {
    color: "bg-gray-400",
    label: "Checking...",
    tooltip: "Checking whether this page is up to date",
  },
  fresh: {
    color: "bg-green-500",
    label: "Up to date",
    tooltip: "This page reflects the latest published content",
  },
  stale: {
    color: "bg-orange-500",
    label: "May be outdated",
    tooltip: "Newer content exists — this page is scheduled to refresh shortly",
  },
};

export default function RuleFreshnessIndicator({ relativePath, staticLastUpdated }: RuleFreshnessIndicatorProps) {
  const [status, setStatus] = useState<FreshnessStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`/api/rule-freshness?relativePath=${encodeURIComponent(relativePath)}`, { cache: "no-store" });
        if (!res.ok || cancelled) {
          setStatus("error");
          return;
        }
        const json = await res.json();
        const currentLastUpdated: string | null = json.lastUpdated ?? null;

        if (!currentLastUpdated || !staticLastUpdated) {
          // Can't compare — treat as fresh to avoid false alarms
          setStatus("fresh");
          return;
        }

        const isStale = new Date(currentLastUpdated) > new Date(staticLastUpdated);
        setStatus(isStale ? "stale" : "fresh");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [relativePath, staticLastUpdated]);

  if (status === "error") return null;

  const config = STATUS_CONFIG[status];

  return (
    <Tooltip text={config.tooltip} opaque>
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
        <span className={`inline-block h-2 w-2 rounded-full ${config.color}`} aria-hidden="true" />
        {config.label}
      </span>
    </Tooltip>
  );
}
