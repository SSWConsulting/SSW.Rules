"use client";

import React from "react";
import { useTina } from "tinacms/dist/react";
import AboutSSWCard from "@/app/(home)/components/AboutSSWCard";
import HelpCard from "@/app/(home)/components/HelpCard";
import HelpImproveCard from "@/app/(home)/components/HelpImproveCard";
import HomepageHeader from "@/app/(home)/components/HomepageHeader";
import JoinConversationCard from "@/app/(home)/components/JoinConversationCard";
import LatestRulesCard from "@/app/(home)/components/LatestRulesCard";
import QuickLinksCard from "@/app/(home)/components/QuickLinksCard";
import WhyRulesCard from "@/app/(home)/components/WhyRulesCard";
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
        <div className="layout-main-section">
          {children}
        </div>
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
