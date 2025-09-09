"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import AboutSSWCard from "@/components/AboutSSWCard";
import HelpCard from "@/components/HelpCard";
import HelpImproveCard from "@/components/HelpImproveCard";
import JoinConversationCard from "@/components/JoinConversationCard";
import RuleCount from "@/components/RuleCount";
import WhyRulesCard from "@/components/WhyRulesCard";
import { LatestRule } from "@/models/LatestRule";
import LatestRulesCard from "@/components/LatestRulesCard";
import Dropdown from "@/components/ui/dropdown";
import { CgSortAz } from "react-icons/cg";
import RuleCard from "@/components/RuleCard";
import Breadcrumbs from "@/components/Breadcrumbs";

interface SearchResult {
  objectID: string;
  title: string;
  slug: string;
  [key: string]: any;
}

interface RuleSearchClientPageProps {
  ruleCount: number;
  latestRulesByUpdated: LatestRule[];
}

export default function RulesSearchClientPage({ ruleCount, latestRulesByUpdated }: RuleSearchClientPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const keyword = searchParams.get("keyword") || "";
  const sortBy = searchParams.get("sortBy") || "lastUpdated";
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const handleSortChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("sortBy", newSort);
    if (keyword) params.set("keyword", keyword);
    router.push(`/search?${params.toString()}`);
  };

  const sortOptions = [
    { value: "lastUpdated", label: "Last Updated" },
    { value: "created", label: "Recently Created" }
  ];

  return (
    <>
      <Breadcrumbs breadcrumbText="Search" />
      <div className="layout-two-columns">
        <div className="layout-main-section">
          <div className="h-[5rem]">
            <SearchBar 
              keyword={keyword}
              sortBy={sortBy}
              onResults={setSearchResults}
            />
          </div>
          
          {searchResults.length > 0 && (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <h2 className="m-0 text-ssw-red font-bold">
                  Search Results ({searchResults.length})
                </h2>
                <div className="flex items-center space-x-2">
                  <CgSortAz className="inline" size={24} />
                  <Dropdown
                    options={sortOptions}
                    value={sortBy}
                    onChange={handleSortChange}
                  />
                </div>
              </div>

              {searchResults.map((result, index) => (
                <RuleCard
                  key={result.objectID}
                  title={result.title}
                  slug={result.slug}
                  lastUpdatedBy={result.lastUpdatedBy}
                  lastUpdated={result.lastUpdated}
                  index={index}
                />
              ))}
            </div>
          )}
            
        </div>

        <div className="layout-sidebar">
          <div className="h-[3.5rem]">
            {ruleCount && <RuleCount count={ruleCount} />}
          </div>
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
