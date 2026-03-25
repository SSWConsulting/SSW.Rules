"use client";

import Link from "next/link";
import { FaComment, FaThumbsDown, FaThumbsUp } from "react-icons/fa";
import { RiTimeFill } from "react-icons/ri";
import { Card } from "@/components/ui/card";
import { timeAgo } from "@/lib/dateUtils";
import { ActivityRule } from "@/models/ActivityRule";

interface RuleActivityCardProps {
  rule: ActivityRule;
  rank: number;
  animatingMetric?: string | null;
  animationEpoch?: number;
  activeSort?: string;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function shortenCategory(title: string): string {
  const match = title.match(/^Rules to Better\s+(.+)$/i);
  return match ? match[1] : title;
}

/** Returns { key, className } to spread onto the element that should animate. */
function metricAnimProps(
  metric: string,
  animatingMetric: string | null | undefined,
  animationEpoch: number,
  activeSort: string | undefined,
  baseClassName: string
) {
  const isAnimating = animatingMetric === metric && animationEpoch > 0;
  const isBold = activeSort === metric;
  return {
    key: isAnimating ? animationEpoch : undefined,
    className: [baseClassName, isAnimating ? "animate-metric-pop" : "", isBold ? "font-bold" : ""].filter(Boolean).join(" "),
  };
}

export default function RuleActivityCard({ rule, rank, animatingMetric, animationEpoch = 0, activeSort }: RuleActivityCardProps) {
  const publishDate = formatDate(rule.created ?? rule.lastUpdated);

  const categoryLabels = rule.categories.length > 0 ? rule.categories.map((cat) => shortenCategory(cat.title)).join(", ") : null;

  return (
    <Card className="mb-4 p-4">
      <div className="flex gap-1 min-w-0">
        {/* Rank number — matches rule-list-item-header style */}
        <span className="text-sm text-gray-500 mr-2 w-6 shrink-0 mt-1">#{rank}</span>

        {/* Card body */}
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          {/* Title — matches rule-list-item-header: text-2xl, no-underline link, a:hover global red */}
          <h2 className="m-0 text-2xl">
            <Link href={`/${rule.uri}`} className="no-underline">
              {rule.title}
            </Link>
          </h2>

          {/* Author + publish date + category */}
          {(rule.authors.length > 0 || publishDate || categoryLabels) && (
            <p className="text-xs text-gray-400 m-0">
              {publishDate && <span>Published on <span className="font-medium text-gray-500">{publishDate}</span></span>}
              {publishDate && rule.authors.length > 0 && <span> by </span>}
              {rule.authors.length > 0 && <span className="font-medium text-gray-500">{rule.authors.join(", ")}</span>}
              {categoryLabels && (
                <>
                  <span> under </span>
                  <span className="font-medium text-gray-500">{categoryLabels}</span>
                </>
              )}
            </p>
          )}

          {/* Short description */}
          {rule.descriptionPreview && <p className="text-sm text-gray-600 m-0 my-2 line-clamp-2">{rule.descriptionPreview}</p>}

          {/* Interaction row — only shown for rules with discussion activity */}
          {rule.discussionUrl && (
            <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
              {/* Thumbs up: icon + count animate together */}
              <a
                {...metricAnimProps(
                  "mostLiked",
                  animatingMetric,
                  animationEpoch,
                  activeSort,
                  "flex items-center gap-1 no-underline text-gray-500 transition-colors cursor-pointer"
                )}
                href={`${rule.discussionUrl}#top`}
                target="_blank"
                rel="noopener noreferrer"
                title="Like this rule on GitHub"
              >
                <FaThumbsUp />
                <span>{rule.thumbsUp}</span>
              </a>

              {/* Thumbs down: no metric emphasis */}
              <a
                href={`${rule.discussionUrl}#top`}
                target="_blank"
                rel="noopener noreferrer"
                title="Dislike this rule on GitHub"
                className="flex items-center gap-1 no-underline text-gray-500 transition-colors cursor-pointer"
              >
                <FaThumbsDown />
                <span>{rule.thumbsDown}</span>
              </a>

              {/* Comments: icon + count + label animate together */}
              <span {...metricAnimProps("mostCommented", animatingMetric, animationEpoch, activeSort, "flex items-center gap-1")} title="Comments">
                <FaComment />
                <span>
                  {rule.commentCount} {rule.commentCount === 1 ? "comment" : "comments"}
                </span>
              </span>

              {/* Last commented: icon + label + timestamp animate together */}
              <span {...metricAnimProps("lastCommented", animatingMetric, animationEpoch, activeSort, "flex items-center gap-1 text-gray-400 ml-auto")}>
                <RiTimeFill />
                <span>Last commented {timeAgo(rule.lastCommentAt)}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
