"use client";

import Link from "next/link";
import React, { useRef } from "react";
import { Rule } from "@/types";
import RuleActionButtons from "../RuleActionButtons";

export interface RuleListItemHeaderProps {
  rule: Rule;
  index: number;
}

const RuleListItemHeader: React.FC<RuleListItemHeaderProps> = ({ rule, index }) => {
  const linkRef = useRef<HTMLAnchorElement>(null);

  return (
    <section className="my-1.5">
      <div className="flex items-start flex-col justify-between sm:flex-row">
        <div className="flex flex-col gap-2">
          <div className="flex">
            <span className="text-sm text-gray-500 mr-2 w-6 shrink-0 mt-1">#{index + 1}</span>
            <h2 className="m-0 text-2xl">
              <Link href={`/${rule.uri}`} title={rule.title} ref={linkRef} className="no-underline">
                {rule.title}
              </Link>
              {rule.isArchived && (
                <span className="inline-block bg-ssw-red text-white text-sm px-2 py-1 ml-2 rounded font-medium relative -top-0.5">Archived</span>
              )}
            </h2>
          </div>
        </div>

        <RuleActionButtons rule={rule} showOpenInChatGpt={false} />
      </div>
    </section>
  );
};

export default RuleListItemHeader;
