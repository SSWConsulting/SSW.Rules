"use client";

import Link from "next/link";
import React, { useRef } from "react";
import { RiTimeFill } from "react-icons/ri";
import { timeAgo } from "@/lib/dateUtils";
import { Rule } from "@/types";
import { RuleOrderBy } from "@/types/ruleOrderBy";
import RuleActionButtons from "../RuleActionButtons";

export interface RuleListItemHeaderProps {
  rule: Rule & { created?: string; lastUpdated?: string };
  index: number;
  currentSort?: string;
}

const RuleListItemHeader: React.FC<RuleListItemHeaderProps> = ({ rule, index, currentSort }) => {
  const linkRef = useRef<HTMLAnchorElement>(null);

  // Determine which time to show based on sort
  const showCreated = currentSort === RuleOrderBy.Created;
  const timeValue = showCreated ? rule.created : rule.lastUpdated;
  const timeLabel = showCreated ? "Created" : "Updated";

  return (
    <section className="my-1.5">
      <div className="flex items-center flex-col justify-between sm:flex-row">
        <div className="flex flex-col gap-2">
          <div className="flex items-start">
            <span className="text-sm text-gray-500 mr-2 w-6 shrink-0 mt-1">#{index + 1}</span>
            <div className="flex flex-col">
              <h2 className="m-0 text-2xl">
                <Link href={`/${rule.uri}`} title={rule.title} ref={linkRef} className="no-underline">
                  {rule.title}
                </Link>
              </h2>
              {timeValue && (
                <span className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                  <RiTimeFill className="inline" size={12} />
                  {timeLabel} {timeAgo(timeValue)}
                </span>
              )}
            </div>
          </div>
          {rule.isArchived && (
            <div className="ml-8 md:ml-6">
              <span className="inline-block bg-red-600 text-white text-sm px-2 py-1 rounded font-medium">Archived</span>
            </div>
          )}
        </div>

        <RuleActionButtons rule={rule} showOpenInChatGpt={false} />
      </div>
    </section>
  );
};

export default RuleListItemHeader;
