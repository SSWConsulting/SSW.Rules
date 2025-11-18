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
      <div className="flex items-center flex-col justify-between sm:flex-row">
        <div className="flex flex-col gap-2">
          <div className="flex">
            <span className="text-sm text-gray-500 mr-2 w-6 shrink-0 mt-1">#{index + 1}</span>
            <h2 className="m-0 text-2xl">
              <Link href={`/${rule.uri}`} title={rule.title} ref={linkRef} className="no-underline">
                {rule.title}
              </Link>
            </h2>
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
