import Image from "next/image";
import Link from "next/link";
import { RiTimeFill } from "react-icons/ri";
import { timeAgo } from "@/lib/dateUtils";
import { RecentComment } from "@/models/RecentComment";

interface RecentCommentsCardProps {
  comments: RecentComment[];
}

export default function RecentCommentsCard({ comments }: RecentCommentsCardProps) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm overflow-hidden">
      <h2 className="text-lg font-bold text-ssw-red mb-8">Recent Comments</h2>

      {comments.length === 0 ? (
        <p className="text-sm text-gray-400">No recent comments found.</p>
      ) : (
        <ul className="space-y-4 pl-0!">
          {comments.map((comment) => (
            <li key={`${comment.guid}-${comment.commentedAt}`} className="overflow-hidden">
              <Link href={`/${comment.ruleUri}`} className="group block no-underline overflow-hidden">
                <div className="flex items-start gap-2 min-w-0">
                  <Image
                    src={comment.authorAvatarUrl}
                    alt={comment.authorLogin}
                    width={32}
                    height={32}
                    className="rounded-full flex-shrink-0 mt-0.5"
                    unoptimized
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 leading-snug mb-1!">
                      <span className="font-medium text-gray-900">{comment.authorLogin}</span>
                      {" commented on "}
                    </p>
                    <p className="text-sm font-medium text-ssw-red group-hover:underline truncate mb-3!">{comment.ruleTitle}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 overflow-hidden break-words mb-2">{comment.bodyPreview}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 mb-4">
                      <RiTimeFill className="flex-shrink-0" />
                      <span>{timeAgo(comment.commentedAt)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
