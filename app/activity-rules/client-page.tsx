"use client";

import { useEffect, useRef, useState } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import RecentCommentsCard from "@/components/RecentCommentsCard";
import RuleActivityCard from "@/components/RuleActivityCard";
import { ActivityRule } from "@/models/ActivityRule";
import { RecentComment } from "@/models/RecentComment";

const PAGE_SIZE = 5;

interface ActivityRulesClientPageProps {
  rules: ActivityRule[];
  total: number;
  recentComments: RecentComment[];
}

export default function ActivityRulesClientPage({ rules, total, recentComments }: ActivityRulesClientPageProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const visibleRules = rules.slice(0, visibleCount);
  const hasMore = visibleCount < total;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, total));
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [total]);

  return (
    <>
      <Breadcrumbs breadcrumbText="Rules by Activity" />
      <h1 className="text-ssw-red font-bold mb-2">Rules by Activity</h1>
      <p className="text-gray-500 mb-6">Rules ranked by most recent comment activity.</p>
      <div className="layout-two-columns">
        <div className="layout-main-section min-w-0">
          {visibleRules.map((rule, i) => (
            <RuleActivityCard key={rule.guid} rule={rule} rank={i + 1} />
          ))}

          {total === 0 && <p className="text-gray-500">No rules with comment activity found.</p>}

          {hasMore && <div ref={sentinelRef} className="h-10" />}
        </div>

        <div className="layout-sidebar min-w-0">
          <RecentCommentsCard comments={recentComments} />
        </div>
      </div>
    </>
  );
}

