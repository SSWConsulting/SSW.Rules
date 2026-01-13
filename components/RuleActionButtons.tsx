"use client";

import { Suspense } from "react";
import { RiGithubFill, RiPencilLine } from "react-icons/ri";
import Bookmark from "@/components/Bookmark";
import useAppInsights from "@/components/hooks/useAppInsights";
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
  const { trackEvent } = useAppInsights();

  if (isAdminPage) return null;

  const handleEditClick = () => {
    trackEvent("EditRuleClicked", {
      ruleUri: rule.uri,
      ruleTitle: rule.title,
      ruleGuid: rule.guid,
    });
  };

  const handleGitHubClick = () => {
    trackEvent("ViewOnGitHubClicked", {
      ruleUri: rule.uri,
      ruleTitle: rule.title,
      ruleGuid: rule.guid,
    });
  };

  return (
    <div className="mt-4 sm:mt-0 flex items-center gap-4 text-2xl pl-7.5">
      {showBookmark && (
        <Suspense fallback={<span className="opacity-50">...</span>}>
          <Bookmark ruleGuid={rule.guid} />
        </Suspense>
      )}
      <IconLink href={`/admin#/~/${sanitizedBasePath}/${rule.uri}`} title="Edit rule with TinaCMS" tooltipOpaque={true} onClick={handleEditClick}>
        <RiPencilLine className="hover:text-tinacms" size={ICON_SIZE} />
      </IconLink>
      <IconLink
        href={`https://github.com/SSWConsulting/SSW.Rules.Content/commits/main/public/uploads/rules/${rule.uri}/rule.mdx`}
        target="_blank"
        title="View rule on GitHub"
        tooltipOpaque={true}
        onClick={handleGitHubClick}
      >
        <RiGithubFill size={ICON_SIZE} className="rule-icon" />
      </IconLink>
      {showOpenInChatGpt && <ChatGPTSummaryButton />}
    </div>
  );
}
