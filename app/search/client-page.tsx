"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CgSortAz } from "react-icons/cg";
import AboutSSWCard from "@/components/AboutSSWCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import HelpCard from "@/components/HelpCard";
import HelpImproveCard from "@/components/HelpImproveCard";
import JoinConversationCard from "@/components/JoinConversationCard";
import LatestRulesCard from "@/components/LatestRulesCard";
import RuleCard from "@/components/RuleCard";
import RuleCount from "@/components/RuleCount";
import SearchBar from "@/components/SearchBarWrapper";
import Spinner from "@/components/Spinner";
import Dropdown from "@/components/ui/dropdown";
import WhyRulesCard from "@/components/WhyRulesCard";
import { LatestRule } from "@/models/LatestRule";

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const previousKeywordRef = useRef<string>("");

  // Reset hasSearched and clear results when keyword changes (new search started)
  useEffect(() => {
    if (keyword !== previousKeywordRef.current) {
      setHasSearched(false);
      setSearchResults([]);
      previousKeywordRef.current = keyword;
    }
  }, [keyword]);

  // Track when search completes (not loading anymore after a search was initiated)
  useEffect(() => {
    if (!isLoading && keyword && keyword.length >= 3) {
      setHasSearched(true);
    }
  }, [isLoading, keyword]);

  const handleSortChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("sortBy", newSort);
    if (keyword) params.set("keyword", keyword);
    router.push(`/search?${params.toString()}`);
  };

  const sortOptions = [
    { value: "lastUpdated", label: "Last Updated" },
    { value: "created", label: "Recently Created" },
  ];

  return (
    <>
      <Breadcrumbs breadcrumbText="Search" />
      <div className="layout-two-columns">
        <div className="layout-main-section">
          <div className="h-[5rem]">
            <SearchBar keyword={keyword} sortBy={sortBy} onResults={setSearchResults} onLoadingChange={setIsLoading} />
          </div>

          {isLoading ? (
            <div className="py-8 flex justify-center">
              <Spinner size="lg" className="text-ssw-red" />
            </div>
          ) : hasSearched && keyword && searchResults.length === 0 ? (
            <div className="py-8">
              <p className="text-center text-gray-600">No results found for "{keyword}". Please try a different search term.</p>
            </div>
          ) : (
            searchResults.length > 0 && (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <h1 className="m-0 text-ssw-red font-bold">Search Results ({searchResults.length})</h1>
                  <div className="flex items-center space-x-2">
                    <CgSortAz className="inline" size={24} />
                    <Dropdown options={sortOptions} value={sortBy} onChange={handleSortChange} />
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
                    authorUrl={result.authorUrl}
                  />
                ))}
              </div>
            )
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
