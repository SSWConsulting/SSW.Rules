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
  { key: "mostLiked", label: "Most Liked" },
  { key: "mostCommented", label: "Most Commented" },
  { key: "lastCommented", label: "Last Commented" },
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
  const [sortKey, setSortKey] = useState<SortKey>("mostLiked");

  const [animatingMetric, setAnimatingMetric] = useState<SortKey | null>(null);
  const [animationEpoch, setAnimationEpoch] = useState(0);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => {
      window.history.scrollRestoration = "auto";
    };
  }, []);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleSortChange = (newSort: SortKey) => {
    setSortKey(newSort);
    setAnimatingMetric(newSort);
    setAnimationEpoch((e) => e + 1);

    // Clear the animation flag after the keyframe finishes so that cards
    // loaded later by infinite scroll mount without the animation class.
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    animationTimerRef.current = setTimeout(() => {
      setAnimatingMetric(null);
      animationTimerRef.current = null;
    }, 1050); // slightly longer than 2 × 0.5s keyframe iterations
  };

  useEffect(
    () => () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    },
    []
  );

  // Keep the URL in sync as a non-blocking side effect.
  // Reads window.location.search so it preserves params owned by the parent
  // (e.g. ?view=activity) and only modifies the ?sort param.
  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const params = new URLSearchParams(window.location.search);
    if (sortKey === "mostLiked") {
      params.delete("sort");
    } else {
      params.set("sort", sortKey);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${basePath}/?${qs}` : `${basePath}/`);
  }, [sortKey]);

  const sortedRules = useMemo(() => sortRules(rules, sortKey), [rules, sortKey]);
  const visibleRules = sortedRules.slice(0, visibleCount);
  const hasMore = visibleCount < total;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sortKey]);

  useEffect(() => {
    if (!hasMore) return;
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
  }, [hasMore, total]);

  return (
    <>
      <div className="flex items-center py-4 px-4">
        <span className="mr-4 hidden sm:block">Sort by</span>
        {SORT_OPTIONS.map(({ key, label }, i) => (
          <RadioButton
            key={key}
            id={`sort-${key}`}
            value={key}
            selectedOption={sortKey}
            handleOptionChange={(e) => handleSortChange(e.target.value as SortKey)}
            labelText={label}
            position={i === 0 ? "first" : i === SORT_OPTIONS.length - 1 ? "last" : "middle"}
          />
        ))}
      </div>
      <div className="layout-two-columns">
        <div className="layout-main-section min-w-0">
          {visibleRules.map((rule, i) => (
            <RuleActivityCard key={rule.guid} rule={rule} rank={i + 1} animatingMetric={animatingMetric} animationEpoch={animationEpoch} activeSort={sortKey} />
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
