"use client";

import useAppInsights from "@/components/hooks/useAppInsights";
import { RefObject, useRef, useEffect } from "react";
import { useTina } from "tinacms/dist/react";
import { useMarkHighlight } from "@/lib/useMarkHighlight";
import ServerRulePage, { ServerRulePageProps } from "./ServerRulePage";

export type TinaRuleProps = {
  serverRulePageProps: ServerRulePageProps;
  tinaQueryProps: any;
};

export function TinaRuleWrapper({ serverRulePageProps, tinaQueryProps }: TinaRuleProps) {
  const { data } = useTina({
    query: tinaQueryProps.query,
    variables: tinaQueryProps.variables,
    data: tinaQueryProps.data,
  });

  const { trackEvent } = useAppInsights();
  const rule = data?.rule;

  // Track rule view
  useEffect(() => {
    if (rule?.uri && rule?.guid) {
      trackEvent("RuleViewed", {
        ruleUri: rule.uri,
        ruleTitle: rule.title || "",
        ruleGuid: rule.guid,
        isArchived: rule.isArchived || false,
        hasAuthors: (rule.authors?.length || 0) > 0,
        hasRelated: (rule.related?.length || 0) > 0,
        categories: serverRulePageProps.ruleCategoriesMapping
          ?.map((c) => c.uri)
          .join(", "),
      });
    }
  }, [rule?.guid, rule?.uri, rule?.title, rule?.isArchived, rule?.authors?.length, rule?.related?.length, serverRulePageProps.ruleCategoriesMapping, trackEvent]);

  const contentRef = useRef<HTMLDivElement>(null);
  useMarkHighlight(contentRef as RefObject<HTMLElement>);

  return (
    <div ref={contentRef}>
      <ServerRulePage tinaProps={{ data }} serverRulePageProps={serverRulePageProps} />
    </div>
  );
}
