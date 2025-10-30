"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { BiChevronDown, BiSearch } from "react-icons/bi";
import {
  Popover,
  PopoverButton,
  Transition,
  PopoverPanel,
} from "@headlessui/react";
import Spinner from "@/components/Spinner";

interface Rule {
  id: string;
  title: string;
  uri: string;
  created?: string;
  lastUpdated?: string;
  _sys: {
    relativePath: string;
  };
}

const MIN_SEARCH_LENGTH = 2;
const RULES_PER_PAGE = 40;

export const PaginatedRuleSelectorInput: React.FC<any> = ({ input }) => {
  const [filter, setFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [filteredRules, setFilteredRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedRuleLabel, setSelectedRuleLabel] = useState<string | null>(null);

  const selectedRule = useMemo(() => {
    return input.value || null;
  }, [input.value]);

  useEffect(() => {
    if(filter && filter.length >= MIN_SEARCH_LENGTH) {
      setIsDebouncing(true);
      const timer = setTimeout(() => {
        setDebouncedFilter(filter);
        setIsDebouncing(false);
      }, 1000);

      return () => {
        clearTimeout(timer);
        setIsDebouncing(false);
      };
    }

    // Clear the rules list when filter is short/empty
    setFilteredRules([]);
    setIsDebouncing(false);
    setCurrentPage(1);
    setHasMore(true);

  }, [filter]);

  // Fetch paginated rules when query changes
  const fetchRules = useCallback(async (page: number, searchQuery: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: RULES_PER_PAGE.toString(),
      });

      if (searchQuery && searchQuery.length >= MIN_SEARCH_LENGTH) {
        params.append('search', searchQuery);
      }

      // Since we are in Tina admin site, we are at /admin so need to drop down a level back to root
      const res = await fetch(`../api/rules?${params.toString()}`, {
        method: "GET",
        cache: "no-store"
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setFilteredRules(data.rules || []);
      setHasMore(data.hasMore || false);
      setTotalCount(data.total || 0);
    } catch (e) {
      console.error("Failed to load rules:", e);
      setFilteredRules([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = debouncedFilter.trim();
    if (q.length >= MIN_SEARCH_LENGTH) {
      setCurrentPage(1);
      fetchRules(1, q);
    } else {
      setFilteredRules([]);
      setHasMore(true);
      setTotalCount(0);
    }
  }, [debouncedFilter, fetchRules]);

  const handleRuleSelect = (rule) => {
    setSelectedRuleLabel(rule.uri);
    const rulePath = `public/uploads/rules/${rule._sys.relativePath}`;
    input.onChange(rulePath);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchRules(newPage, debouncedFilter.trim());
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchRules(newPage, debouncedFilter.trim());
    }
  };

  return (
    <div className="relative z-[1000]">
      <input type="hidden" id={input.name} {...input} />
      <Popover>
        {({ open }) => (
          <>
            <PopoverButton
              className="text-sm h-11 px-4 justify-between w-full bg-white border border-gray-200 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors flex items-center"
            >
              <span>{selectedRuleLabel || "Select a rule"}</span>
              <BiChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </PopoverButton>
            <div
              className="absolute inset-x-0 -bottom-2 translate-y-full z-[1000]"
            >
              <Transition
                enter="transition duration-150 ease-out"
                enterFrom="transform opacity-0 -translate-y-2"
                enterTo="transform opacity-100 translate-y-0"
                leave="transition duration-75 ease-in"
                leaveFrom="transform opacity-100 translate-y-0"
                leaveTo="transform opacity-0 -translate-y-2"
              >
                <PopoverPanel className="relative overflow-hidden rounded-lg shadow-lg bg-white border border-gray-150 z-50">
                  {({ close }) => (
                    <div className="max-h-[70vh] flex flex-col w-full">
                      {/* Search header */}
                      <div className="bg-gray-50 p-2 border-b border-gray-100 z-10 shadow-sm">
                        <div className="relative">
                          <BiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            className="bg-white text-sm rounded-sm border border-gray-100 shadow-inner py-1.5 pl-10 pr-3 w-full block placeholder-gray-400"
                            onClick={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                            }}
                            value={filter}
                            onChange={(event) => {
                              setFilter(event.target.value);
                            }}
                            placeholder="Enter rule URI, e.g. 3-steps-to-a-pbi"
                          />
                        </div>
                      </div>

                      {/* Loading state during debounce or API fetch */}
                      {(isDebouncing || loading) && filter.length >= MIN_SEARCH_LENGTH && (
                        <div className="p-4 text-center">
                          <Spinner size="sm" inline className="mx-auto" />
                          <div className="text-xs text-gray-500 mt-2">
                            {isDebouncing ? 'Typing...' : 'Loading rules...'}
                          </div>
                        </div>
                      )}

                      {/* Empty state */}
                      {!loading && !isDebouncing && filteredRules.length === 0 && filter.length >= MIN_SEARCH_LENGTH && (
                        <div className="p-4 text-center text-gray-400">
                          No rules found matching your search
                        </div>
                      )}

                      {/* Rules list */}
                      {!loading && !isDebouncing && filteredRules.length > 0 && (
                        <>
                          <div className="flex-1 overflow-y-auto">
                            {filteredRules.map((rule) => {
                              const selectedRel = selectedRule
                                ? selectedRule.replace(/^public\/uploads\/rules\//, '').replace(/^rules\//, '')
                                : null;
                              const isSelected = selectedRel === rule._sys.relativePath;

                              return (
                                <button
                                  key={rule.id || rule._sys.relativePath}
                                  className={`w-full text-left py-2 px-3 hover:bg-gray-50 border-b border-gray-100 transition-colors block ${
                                    isSelected ? 'bg-blue-50 border-blue-200' : ''
                                  }`}
                                  onClick={() => {
                                    handleRuleSelect(rule);
                                    close();
                                  }}
                                >
                                  <div className="flex items-center justify-between w-full gap-3">
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                      <div className="font-medium text-gray-900 text-sm leading-5 truncate">
                                        {rule.title}
                                      </div>
                                    </div>
                                    <div className="text-xs text-gray-500 leading-4 whitespace-nowrap text-right">
                                      {rule.uri}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Pagination controls */}
                          <div className="bg-gray-50 border-t border-gray-100 px-3 py-2 flex items-center justify-between">
                            <div className="text-xs text-gray-600">
                              Page {currentPage} {totalCount > 0 && `• ${totalCount} results`}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={handlePreviousPage}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Previous
                              </button>
                              <button
                                onClick={handleNextPage}
                                disabled={!hasMore}
                                className="px-3 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </PopoverPanel>
              </Transition>
            </div>
          </>
        )}
      </Popover>
    </div>
  );
};