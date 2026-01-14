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
  const [currentQuery, setCurrentQuery] = useState<string>("");
  const [inputValue, setInputValue] = useState<string>("");
  const previousKeywordRef = useRef<string>("");
  const initialResultsRef = useRef<SearchResult[]>([]);
  const hasInputChangedRef = useRef<boolean>(false);

  // Save initial results on page load when keyword exists and we haven't saved them yet
  useEffect(() => {
    if (keyword && keyword.length >= 3 && initialResultsRef.current.length === 0 && searchResults.length > 0 && !hasInputChangedRef.current) {
      initialResultsRef.current = [...searchResults];
    }
  }, [keyword, searchResults]);

  // Track when input field changes from initial keyword
  useEffect(() => {
    if (inputValue && inputValue.trim() !== keyword) {
      hasInputChangedRef.current = true;
    } else if (!inputValue || inputValue.trim() === keyword) {
      hasInputChangedRef.current = false;
    }
  }, [inputValue, keyword]);

  // Reset hasSearched and clear results when keyword changes (new search started)
  useEffect(() => {
    if (keyword !== previousKeywordRef.current) {
      setHasSearched(false);
      setSearchResults([]);
      initialResultsRef.current = [];
      hasInputChangedRef.current = false;
      previousKeywordRef.current = keyword;
    }
  }, [keyword]);

  // Track when search completes (not loading anymore after a search was initiated)
  useEffect(() => {
    if (!isLoading && currentQuery && currentQuery.length >= 3) {
      setHasSearched(true);
    } else if (!currentQuery || currentQuery.length === 0) {
      // Reset hasSearched when query is cleared, but only if input is also empty
      if (!inputValue || inputValue.trim().length === 0) {
        setHasSearched(false);
      }
    }
  }, [isLoading, currentQuery, inputValue]);

  // Determine which results to display:
  // - If input changed and current search is empty, show initial results
  // - Otherwise, show current search results
  const displayResults =
    hasInputChangedRef.current && searchResults.length === 0 && initialResultsRef.current.length > 0 ? initialResultsRef.current : searchResults;

  // Determine which query to use for display: use keyword param if input is empty, otherwise use currentQuery
  const displayQuery = (!inputValue || inputValue.trim().length === 0) && keyword ? keyword : currentQuery;

  // Show results if: input is empty and keyword exists, OR input has value and currentQuery is valid, OR we have initial results to fall back to
  const shouldShowResults =
    displayResults.length > 0 &&
    (((!inputValue || inputValue.trim().length === 0) && keyword && keyword.length >= 3) ||
      (currentQuery && currentQuery.length >= 3) ||
      (hasInputChangedRef.current && initialResultsRef.current.length > 0));

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
          <div className="h-20">
            <SearchBar
              keyword={keyword}
              sortBy={sortBy}
              onResults={setSearchResults}
              onLoadingChange={setIsLoading}
              onQueryChange={setCurrentQuery}
              onInputValueChange={setInputValue}
            />
          </div>

          {isLoading ? (
            <div className="py-8 flex justify-center">
              <Spinner size="lg" className="text-ssw-red" />
            </div>
          ) : hasSearched && displayQuery && displayQuery.length >= 3 && searchResults.length === 0 ? (
            <div className="py-8">
              <p className="text-center text-gray-600">No results found for "{displayQuery}". Please try a different search term.</p>
            </div>
          ) : (
            shouldShowResults && (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <h1 className="m-0 text-ssw-red font-bold">Search Results ({displayResults.length})</h1>
                  <div className="flex items-center space-x-2">
                    <CgSortAz className="inline" size={24} />
                    <Dropdown options={sortOptions} value={sortBy} onChange={handleSortChange} />
                  </div>
                </div>

                {displayResults.map((result, index) => (
                  <RuleCard
                    key={result.objectID}
                    title={result.title}
                    slug={result.slug}
                    lastUpdatedBy={result.lastUpdatedBy}
                    lastUpdated={result.lastUpdated}
                    index={index}
                    authorUrl={result.authors?.[0]?.url ?? null}
                  />
                ))}
              </div>
            )
          )}
        </div>

        <div className="layout-sidebar">
          <div className="h-14">{ruleCount && <RuleCount count={ruleCount} />}</div>
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
