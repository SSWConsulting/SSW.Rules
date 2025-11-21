"use client";

import AboutSSWCard from "@/components/AboutSSWCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import HelpCard from "@/components/HelpCard";
import HelpImproveCard from "@/components/HelpImproveCard";
import JoinConversationCard from "@/components/JoinConversationCard";
import LatestRulesList from "@/components/LatestRulesList";
import RuleCount from "@/components/RuleCount";
import SearchBar from "@/components/SearchBarWrapper";
import WhyRulesCard from "@/components/WhyRulesCard";
import { LatestRule } from "@/models/LatestRule";

interface LatestRuleClientPageProps {
  ruleCount: number;
  latestRulesByUpdated: LatestRule[];
  latestRulesByCreated: LatestRule[];
}

export default function LatestRuleClientPage({ ruleCount, latestRulesByUpdated, latestRulesByCreated }: LatestRuleClientPageProps) {
  return (
    <>
      <Breadcrumbs breadcrumbText="Latest Rules" />
      <div className="layout-two-columns">
        <div className="layout-main-section">
          <div className="h-20">
            <SearchBar />
          </div>

          <LatestRulesList rulesByUpdated={latestRulesByUpdated} rulesByCreated={latestRulesByCreated} title="Latest Rules" />
        </div>

        <div className="layout-sidebar">
          <div className="h-14">{ruleCount && <RuleCount count={ruleCount} />}</div>
          <WhyRulesCard />
          <HelpImproveCard />
          <HelpCard />
          <AboutSSWCard />
          <JoinConversationCard />
        </div>
      </div>
    </>
  );
}
