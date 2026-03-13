import Link from "next/link";
import { FaComment, FaThumbsDown, FaThumbsUp } from "react-icons/fa";
import { RiTimeFill } from "react-icons/ri";
import { Card } from "@/components/ui/card";
import { timeAgo } from "@/lib/dateUtils";
import { ActivityRule } from "@/models/ActivityRule";

interface RuleActivityCardProps {
  rule: ActivityRule;
  rank: number;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" });
}

export default function RuleActivityCard({ rule, rank }: RuleActivityCardProps) {
  const publishDate = formatDate(rule.created);

  return (
    <Card className="mb-4 p-4">
      <div className="flex gap-3 min-w-0">
        {/* Rank number */}
        <span className="text-gray-300 font-bold text-lg leading-tight flex-shrink-0 w-6 text-right">#{rank}</span>

        {/* Card body */}
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          {/* Title */}
          <Link href={`/${rule.uri}`} className="no-underline group">
            <h2 className="m-0 text-xl font-bold leading-tight group-hover:text-ssw-red transition-colors">{rule.title}</h2>
          </Link>

          {/* Tags / categories */}
          {rule.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {rule.categories.map((cat) => (
                <Link key={cat.uri || cat.title} href={cat.uri ? `/${cat.uri}` : "#"} className="no-underline">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                    {cat.title}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Author + publish date */}
          {(rule.authors.length > 0 || publishDate) && (
            <p className="text-xs text-gray-400 m-0">
              {rule.authors.length > 0 && (
                <>
                  <span className="font-medium text-gray-500">{rule.authors.join(", ")}</span>
                </>
              )}
              {rule.authors.length > 0 && publishDate && <span className="mx-1">·</span>}
              {publishDate && <span>Published {publishDate}</span>}
            </p>
          )}

          {/* Short description */}
          {rule.descriptionPreview && <p className="text-sm text-gray-600 m-0 line-clamp-2">{rule.descriptionPreview}</p>}

          {/* Interaction row */}
          <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
            <a
              href={`${rule.discussionUrl}#top`}
              target="_blank"
              rel="noopener noreferrer"
              title="Like this rule on GitHub"
              className="flex items-center gap-1 no-underline text-gray-500 transition-colors cursor-pointer"
            >
              <FaThumbsUp />
              <span>{rule.thumbsUp}</span>
            </a>
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
            <span className="flex items-center gap-1" title="Comments">
              <FaComment />
              <span>
                {rule.commentCount} {rule.commentCount === 1 ? "comment" : "comments"}
              </span>
            </span>
            <span className="flex items-center gap-1 text-gray-400 ml-auto">
              <RiTimeFill />
              <span>Last commented {timeAgo(rule.lastCommentAt)}</span>
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
