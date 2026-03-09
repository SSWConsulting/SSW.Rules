"use client";

import Image from "next/image";
import Link from "next/link";
import { RiTimeFill } from "react-icons/ri";
import { Card } from "@/components/ui/card";
import { timeAgo } from "@/lib/dateUtils";
import { LatestComment } from "@/models/LatestComment";

const MAX_COMMENT_LENGTH = 120;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

interface LatestCommentsCardProps {
  comments: LatestComment[];
}

export default function LatestCommentsCard({ comments }: LatestCommentsCardProps) {
  if (!comments.length) return null;

  return (
    <Card title="Latest Comments">
      <ul className="flex flex-col gap-4">
        {comments.map((comment, index) => (
          <li key={index} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Image
                src={comment.authorAvatarUrl}
                alt={comment.authorLogin}
                width={28}
                height={28}
                className="rounded-full"
              />
              <a
                href={comment.authorProfileUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-sm font-semibold hover:underline"
              >
                {comment.authorLogin}
              </a>
              <p className="text-xs text-gray-400 flex items-center gap-1 ml-auto shrink-0">
                <RiTimeFill className="inline" />
                {timeAgo(comment.createdAt)}
              </p>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {truncate(comment.body, MAX_COMMENT_LENGTH)}
            </p>

            {comment.ruleUrl && (
              <Link
                href={`/${comment.ruleUrl}`}
                className="text-sm text-ssw-red hover:underline mt-1"
              >
                {comment.ruleTitle}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
