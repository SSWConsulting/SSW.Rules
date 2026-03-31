"use client";

import React from "react";
import { useTina } from "tinacms/dist/react";
import AboutSSWCard from "@/components/AboutSSWCard";
import HelpCard from "@/components/HelpCard";
import HelpImproveCard from "@/components/HelpImproveCard";
import HomepageHeader from "@/components/HomepageHeader";
import JoinConversationCard from "@/components/JoinConversationCard";
import LatestRulesCard from "@/components/LatestRulesCard";
import QuickLinksCard from "@/components/QuickLinksCard";
import WhyRulesCard from "@/components/WhyRulesCard";
import { LatestRule } from "@/models/LatestRule";

interface TinaHomepageWrapperProps {
  tinaHomepageProps: { query: string; variables: any; data: any };
  ruleCount: number;
  latestRules: LatestRule[];
  children: React.ReactNode;
}

export default function TinaHomepageWrapper({ tinaHomepageProps, ruleCount, latestRules, children }: TinaHomepageWrapperProps) {
  const { data } = useTina({
    query: tinaHomepageProps.query,
    variables: tinaHomepageProps.variables,
    data: tinaHomepageProps.data,
  });

  const homepage = data?.homepage;

  return (
    <>
      <HomepageHeader homepage={homepage} ruleCount={ruleCount} />
      <div className="layout-two-columns">
        <div className="layout-main-section">{children}</div>
        <div className="layout-sidebar max-sm:mt-0">
          <LatestRulesCard rules={latestRules} />
          <QuickLinksCard data={homepage?.quickLinks} />
          <WhyRulesCard data={homepage?.whyRules} />
          <HelpImproveCard data={homepage?.helpImprove} />
          <HelpCard data={homepage?.needHelp} />
          <AboutSSWCard data={homepage?.aboutSsw} />
          <JoinConversationCard data={homepage?.joinConversation} />
        </div>
      </div>
    </>
  );
}
