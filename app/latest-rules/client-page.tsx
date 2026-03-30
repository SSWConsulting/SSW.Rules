"use client";

import AboutSSWCard from "@/app/(home)/components/AboutSSWCard";
import Breadcrumbs from "@/app/(home)/components/Breadcrumbs";
import HelpCard from "@/app/(home)/components/HelpCard";
import HelpImproveCard from "@/app/(home)/components/HelpImproveCard";
import JoinConversationCard from "@/app/(home)/components/JoinConversationCard";
import LatestRulesList from "@/app/(home)/components/LatestRulesList";
import RuleCount from "@/app/(home)/components/RuleCount";
import SearchBar from "@/app/(home)/components/SearchBarWrapper";
import WhyRulesCard from "@/app/(home)/components/WhyRulesCard";
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
