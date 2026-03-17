"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RecentCommentsCard from "@/components/RecentCommentsCard";
import RuleActivityCard from "@/components/RuleActivityCard";
import RadioButton from "@/components/radio-button/radio-button";
import { ActivityRule } from "@/models/ActivityRule";
import { RecentComment } from "@/models/RecentComment";

const PAGE_SIZE = 5;

type SortKey = "lastCommented" | "mostCommented" | "mostLiked";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "lastCommented", label: "Last Commented" },
  { key: "mostCommented", label: "Most Commented" },
  { key: "mostLiked", label: "Most Liked" },
];

function sortRules(rules: ActivityRule[], sortKey: SortKey): ActivityRule[] {
  return [...rules].sort((a, b) => {
    switch (sortKey) {
      case "lastCommented":
        return new Date(b.lastCommentAt || 0).getTime() - new Date(a.lastCommentAt || 0).getTime();
      case "mostCommented":
        return (b.commentCount ?? 0) - (a.commentCount ?? 0) || a.title.localeCompare(b.title);
      case "mostLiked":
        return (b.thumbsUp ?? 0) - (a.thumbsUp ?? 0) || a.title.localeCompare(b.title);
    }
  });
}

interface ActivityRulesViewProps {
  rules: ActivityRule[];
  total: number;
  recentComments: RecentComment[];
}

export default function ActivityRulesView({ rules, total, recentComments }: ActivityRulesViewProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sortKey, setSortKey] = useState<SortKey>("lastCommented");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const sortedRules = useMemo(() => sortRules(rules, sortKey), [rules, sortKey]);
  const visibleRules = sortedRules.slice(0, visibleCount);
  const hasMore = visibleCount < total;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sortKey]);

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
      <div className="flex items-center py-4">
        <span className="mr-4 hidden sm:block">Sort by</span>
        {SORT_OPTIONS.map(({ key, label }, i) => (
          <RadioButton
            key={key}
            id={`sort-${key}`}
            value={key}
            selectedOption={sortKey}
            handleOptionChange={(e) => setSortKey(e.target.value as SortKey)}
            labelText={label}
            position={i === 0 ? "first" : i === SORT_OPTIONS.length - 1 ? "last" : "middle"}
          />
        ))}
      </div>
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
