"use client";

import { useMemo, useState } from "react";
import AboutSSWCard from "@/components/AboutSSWCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import HelpCard from "@/components/HelpCard";
import HelpImproveCard from "@/components/HelpImproveCard";
import JoinConversationCard from "@/components/JoinConversationCard";
import RuleCount from "@/components/RuleCount";
import RuleList from "@/components/rule-list/rule-list";
import SearchBar from "@/components/SearchBarWrapper";
import WhyRulesCard from "@/components/WhyRulesCard";
import { RuleListFilter } from "@/types/ruleListFilter";
import { RuleOrderBy } from "@/types/ruleOrderBy";

interface LatestRuleClientPageProps {
  ruleCount: number;
  latestRulesByUpdated: any[];
  latestRulesByCreated: any[];
}

export default function LatestRuleClientPage({ ruleCount, latestRulesByUpdated, latestRulesByCreated }: LatestRuleClientPageProps) {
  const [currentSort, setCurrentSort] = useState<string>(RuleOrderBy.LastUpdated);

  const sortOptions = useMemo(
    () => [
      { value: RuleOrderBy.LastUpdated, label: "Last Updated", rules: latestRulesByUpdated },
      { value: RuleOrderBy.Created, label: "Recently Created", rules: latestRulesByCreated },
    ],
    [latestRulesByUpdated, latestRulesByCreated]
  );

  return (
    <>
      <Breadcrumbs breadcrumbText="Latest Rules" />
      <div className="layout-two-columns">
        <div className="layout-main-section">
          <div className="h-20">
            <SearchBar />
          </div>
          <div className="w-full bg-white pt-4 p-6 border border-[#CCC] rounded shadow-lg">
            <h1 className="m-0 mb-4 text-ssw-red font-bold">Latest Rules</h1>
            <RuleList
              rules={latestRulesByUpdated}
              initialView={RuleListFilter.TitleOnly}
              showEverythingView={false}
              initialPerPage={10}
              showPagination={true}
              sortOptions={sortOptions}
              initialSort={RuleOrderBy.LastUpdated}
              onSortChange={setCurrentSort}
            />
          </div>
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
