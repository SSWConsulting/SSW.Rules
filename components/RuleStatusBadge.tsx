"use client";

import { useEffect, useState } from "react";
import Tooltip from "@/components/tooltip/tooltip";
import { getRuleStatus, getRuleStatusDescription, type RuleStatus } from "@/lib/ruleStatus";
import { cn } from "@/lib/utils";

interface RuleStatusBadgeProps {
  pageGeneratedAt?: number;
  ruleSlug?: string;
  className?: string;
}

const dotStyles = {
  fresh: "bg-green-500",
  stale: "bg-orange-500",
  rebuilding: "bg-yellow-500",
} as const;

export default function RuleStatusBadge({ pageGeneratedAt, ruleSlug, className }: RuleStatusBadgeProps) {
  const [status, setStatus] = useState<RuleStatus>("fresh");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ruleSlug) return;

    const fetchStatus = async () => {
      try {
        const params = new URLSearchParams({ slug: ruleSlug });
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/isr-status?${params.toString()}`);
        if (response.ok) {
          const { lastWebhookAt } = await response.json();
          setStatus(getRuleStatus(pageGeneratedAt, lastWebhookAt));
        }
      } catch {
        // Silently fail — default to "fresh"
      } finally {
        setLoaded(true);
      }
    };

    fetchStatus();
  }, [ruleSlug, pageGeneratedAt]);

  if (!loaded) return null;

  const description = getRuleStatusDescription(status);

  return (
    <Tooltip text={description} showDelay={0} hideDelay={0} opaque={true}>
      <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", dotStyles[status], className)} aria-label={description} role="img" />
    </Tooltip>
  );
}
