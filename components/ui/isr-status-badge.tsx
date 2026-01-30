"use client";

import React from "react";
import { cn } from "@/lib/utils";
import Tooltip from "../tooltip/tooltip";

// Threshold in ms - if the page was generated within this time, it's fresh
const FRESH_THRESHOLD_MS = 10000; // 10 seconds

interface IsrStatusBadgeProps {
  /** Timestamp (Date.now()) from when the page was rendered on the server */
  generatedAt: number;
}

export default function IsrStatusBadge({ generatedAt }: IsrStatusBadgeProps) {
  const [isLive, setIsLive] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const pageAge = Date.now() - generatedAt;
    setIsLive(pageAge < FRESH_THRESHOLD_MS);
  }, [generatedAt]);

  if (isLive === null) {
    return <span className="inline-block h-2 w-2 rounded-full bg-zinc-300 animate-pulse" aria-hidden="true" />;
  }

  const tooltip = isLive
    ? "Live - Page is fresh"
    : "Cached - Refresh for latest";

  const style = isLive
    ? "bg-green-500" // Green - Live
    : "bg-yellow-400"; // Yellow - Cached, may need refresh

  return (
    <Tooltip text={tooltip} showDelay={false} hideDelay={false} opaque={true}>
      <span className={cn("inline-block h-2 w-2 rounded-full", style)} aria-label={tooltip} />
    </Tooltip>
  );
}
