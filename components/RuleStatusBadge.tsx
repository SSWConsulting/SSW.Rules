"use client";

import { useEffect, useState } from "react";
import Tooltip from "@/components/tooltip/tooltip";
import { getRuleStatus, getRuleStatusDescription } from "@/lib/ruleStatus";
import { cn } from "@/lib/utils";

interface RuleStatusBadgeProps {
  lastUpdated: string | null | undefined;
  rulePath?: string;
  className?: string;
}

const dotStyles = {
  fresh: "bg-green-500",
  stale: "bg-orange-500",
  rebuilding: "bg-yellow-500",
} as const;

export default function RuleStatusBadge({ lastUpdated, rulePath, className }: RuleStatusBadgeProps) {
  const [isBeingRebuilt, setIsBeingRebuilt] = useState(false);

  useEffect(() => {
    if (!rulePath) return;

    const checkOpenPRs = async () => {
      try {
        const params = new URLSearchParams({ path: rulePath });
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/github-open-prs?${params.toString()}`);
        if (response.ok) {
          const { hasOpenPRs } = await response.json();
          setIsBeingRebuilt(hasOpenPRs);
        }
      } catch {
        // Silently fail — default to no "rebuilding" state
      }
    };

    checkOpenPRs();
  }, [rulePath]);

  const status = getRuleStatus(lastUpdated, isBeingRebuilt);
  if (!status) return null;

  const description = getRuleStatusDescription(lastUpdated, status);

  return (
    <Tooltip text={description} showDelay={0} hideDelay={0} opaque={true}>
      <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", dotStyles[status], className)} aria-label={description} role="img" />
    </Tooltip>
  );
}
