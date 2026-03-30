import Image from "next/image";
import Link from "next/link";
import { RiTimeFill } from "react-icons/ri";
import { Card } from "@/app/(home)/components/ui/card";
import { timeAgo } from "@/lib/dateUtils";
import { RecentComment } from "@/models/RecentComment";

interface RecentCommentsCardProps {
  comments: RecentComment[];
}

export default function RecentCommentsCard({ comments }: RecentCommentsCardProps) {
  return (
    <Card title="Recent Comments">
      {comments.length === 0 ? (
        <p className="text-sm text-gray-400">No recent comments found.</p>
      ) : (
        <ul className="list-none pl-0 m-0 space-y-4">
          {comments.map((comment) => (
            <li key={`${comment.guid}-${comment.commentedAt}`}>
              <div className="flex items-start gap-3">
                <Image src={comment.authorAvatarUrl} alt={comment.authorLogin} width={48} height={48} className="rounded-md flex-shrink-0" unoptimized />
                <div className="min-w-0 flex-1">
                  {/* Commenter name — not a link */}
                  <p className="text-sm text-gray-500 m-0 mb-0.5">
                    <span className="font-medium text-gray-500">{comment.authorLogin}</span>
                    {" on"}
                  </p>

                  {/* Rule title — link only, black by default, red on hover via global a:hover */}
                  <Link href={`/${comment.ruleUri}`} className="no-underline">
                    <p className="text-sm font-medium m-0 mb-1">{comment.ruleTitle}</p>
                  </Link>

                  <p className="text-xs text-gray-500 m-0 my-2 line-clamp-2 break-words">{comment.bodyPreview}</p>

                  <p className="text-xs text-gray-400 flex items-center gap-1 m-0 mb-3">
                    <RiTimeFill className="flex-shrink-0" />
                    <span>{timeAgo(comment.commentedAt)}</span>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
