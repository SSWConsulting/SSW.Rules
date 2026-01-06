"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import AboutSSWCard from "@/components/AboutSSWCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import HelpCard from "@/components/HelpCard";
import HelpImproveCard from "@/components/HelpImproveCard";
import JoinConversationCard from "@/components/JoinConversationCard";
import LatestRulesCard from "@/components/LatestRulesCard";
import RuleCount from "@/components/RuleCount";
import RuleList from "@/components/rule-list/rule-list";
import SearchBar from "@/components/SearchBarWrapper";
import WhyRulesCard from "@/components/WhyRulesCard";
import { LatestRule } from "@/models/LatestRule";
import { RuleListFilter } from "@/types/ruleListFilter";

interface SearchResult {
  objectID: string;
  title: string;
  slug: string;
  lastUpdated?: string;
  lastUpdatedBy?: string;
  [key: string]: any;
}

interface RuleSearchClientPageProps {
  ruleCount: number;
  latestRulesByUpdated: LatestRule[];
}

export default function RulesSearchClientPage({ ruleCount, latestRulesByUpdated }: RuleSearchClientPageProps) {
  const searchParams = useSearchParams();
  const keyword = searchParams.get("keyword") || "";
  const sortBy = searchParams.get("sortBy") || "lastUpdated";
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Transform search results to match RuleList expected format
  const rulesForList = useMemo(
    () =>
      searchResults.map((result) => ({
        guid: result.objectID,
        uri: result.slug,
        title: result.title,
        lastUpdated: result.lastUpdated,
        lastUpdatedBy: result.lastUpdatedBy,
      })),
    [searchResults]
  );

  return (
    <>
      <Breadcrumbs breadcrumbText="Search" />
      <div className="layout-two-columns">
        <div className="layout-main-section">
          <div className="h-[5rem]">
            <SearchBar keyword={keyword} sortBy={sortBy} onResults={setSearchResults} />
          </div>

          {searchResults.length > 0 && (
            <div className="w-full bg-white pt-4 p-6 border border-[#CCC] rounded shadow-lg">
              <h1 className="m-0 mb-4 text-ssw-red font-bold">Search Results ({searchResults.length})</h1>
              <RuleList
                rules={rulesForList}
                initialView={RuleListFilter.TitleOnly}
                showTitlesView={false}
                showBlurbsView={false}
                showEverythingView={false}
                showPagination={true}
                initialPerPage={10}
              />
            </div>
          )}
        </div>

        <div className="layout-sidebar">
          <div className="h-[3.5rem]">{ruleCount && <RuleCount count={ruleCount} />}</div>
          <LatestRulesCard rules={latestRulesByUpdated} />
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
