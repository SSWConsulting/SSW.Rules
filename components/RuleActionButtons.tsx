"use client";

import { Suspense } from "react";
import { RiGithubFill, RiPencilLine } from "react-icons/ri";
import Bookmark from "@/components/Bookmark";
import { useIsAdminPage } from "@/components/hooks/useIsAdminPage";
import ChatGPTSummaryButton from "@/components/OpenInChatGptButton";
import { IconLink } from "@/components/ui";
import { ICON_SIZE } from "@/constants";
import { getSanitizedBasePath } from "@/lib/withBasePath";
import { Rule } from "@/types/rule";

interface RuleActionButtonsProps {
  rule: Rule;
  showBookmark?: boolean;
  showOpenInChatGpt?: boolean;
}

export default function RuleActionButtons({ rule, showBookmark = true, showOpenInChatGpt = true }: RuleActionButtonsProps) {
  const sanitizedBasePath = getSanitizedBasePath();
  const { isAdmin: isAdminPage } = useIsAdminPage();

  if (isAdminPage) return null;

  return (
    <div className="mt-4 md:mt-0 flex items-center gap-4 text-2xl">
      {showBookmark && (
        <Suspense fallback={<span className="opacity-50">...</span>}>
          <Bookmark ruleGuid={rule.guid} />
        </Suspense>
      )}
      <IconLink href={`/admin#/~/${sanitizedBasePath}/${rule.uri}`} title="Edit rule with TinaCMS" tooltipOpaque={true}>
        <RiPencilLine className="hover:text-tinacms" size={ICON_SIZE} />
      </IconLink>
      <IconLink
        href={`https://github.com/SSWConsulting/SSW.Rules.Content/blob/main/public/uploads/rules/${rule.uri}/rule.mdx`}
        target="_blank"
        title="View rule on GitHub"
        tooltipOpaque={true}
      >
        <RiGithubFill size={ICON_SIZE} className="rule-icon" />
      </IconLink>
      {showOpenInChatGpt && <ChatGPTSummaryButton />}
    </div>
  );
}
