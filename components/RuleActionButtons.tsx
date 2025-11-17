"use client";

import { Suspense } from "react";
import { RiGithubLine, RiPencilLine } from "react-icons/ri";
import Bookmark from "@/components/Bookmark";
import { useIsAdminPage } from "@/components/hooks/useIsAdminPage";
import ChatGPTSummaryButton from "@/components/OpenInChatGptButton";
import { IconLink } from "@/components/ui";
import { ICON_SIZE } from "@/constants";
import { Rule } from "@/types/rule";

interface RuleActionButtonsProps {
  rule: Rule;
  sanitizedBasePath: string;
}

export default function RuleActionButtons({ rule, sanitizedBasePath }: RuleActionButtonsProps) {
  const { isAdmin: isAdminPage } = useIsAdminPage();

  if (isAdminPage) return null;

  return (
    <div className="flex items-center gap-4 text-2xl">
      <Suspense fallback={<span className="opacity-50">...</span>}>
        <Bookmark ruleGuid={rule.guid} />
      </Suspense>
      <IconLink href={`/admin#/~/${sanitizedBasePath}/${rule.uri}`} title="Edit rule" tooltipOpaque={true}>
        <RiPencilLine size={ICON_SIZE} />
      </IconLink>
      <IconLink
        href={`https://github.com/SSWConsulting/SSW.Rules.Content/blob/main/rules/${rule.uri}/rule.md`}
        target="_blank"
        title="View rule on GitHub"
        tooltipOpaque={true}
      >
        <RiGithubLine size={ICON_SIZE} className="rule-icon" />
      </IconLink>
      <ChatGPTSummaryButton />
    </div>
  );
}
