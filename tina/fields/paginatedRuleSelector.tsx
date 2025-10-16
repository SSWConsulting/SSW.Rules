"use client";
import React, { useState, useEffect, useMemo } from "react";
import { BiChevronRight, BiChevronLeft, BiChevronDown, BiSearch } from "react-icons/bi";
import {
  Popover,
  PopoverButton,
  Transition,
  PopoverPanel,
} from "@headlessui/react";

interface Rule {
  id: string;
  title: string;
  uri: string;
  _sys: {
    relativePath: string;
  };
}

const RULES_PER_PAGE = 25;
const SEARCH_FETCH_SIZE = 100;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const PaginatedRuleSelectorInput: React.FC<any> = ({ input }) => {
  const [filter, setFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [allRules, setAllRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [startCursor, setStartCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const selectedRule = useMemo(() => {
    return input.value || null;
  }, [input.value]);

  const fetchRules = async (
    searchFilter: string = "",
    after?: string,
    before?: string,
    reset: boolean = false
  ) => {
    setLoading(true);
    try {
      const isSearch = searchFilter.trim().length > 0;
  
      const pageSize = isSearch ? SEARCH_FETCH_SIZE : RULES_PER_PAGE;
  
      const params = new URLSearchParams();
      if (after && !before) params.set("first", String(pageSize));
      if (before && !after) params.set("last", String(pageSize));
      if (!after && !before) params.set("first", String(pageSize));
  
      if (after) params.set("after", after);
      if (before) params.set("before", before);
  
      const res = await fetch(`${basePath}/api/rules/paginated?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
  
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
      const data = await res.json();
  
      const newRules: Rule[] = (data?.items ?? [])
        .map((node: any) => ({
          id: node?.id || "",
          title: node?.title || "",
          uri: node?.uri || "",
          _sys: { relativePath: node?._sys?.relativePath || "" },
        }))
        .filter((r: Rule) => r.id || r._sys?.relativePath);
  
      if (reset || !isSearch) {
        setAllRules(newRules);
        if (reset) setCurrentPage(1);
      } else {
        setAllRules(prev => {
          const uniqueRules = new Map<string, Rule>();
          const getKey = (r: Rule) => r.id || r._sys?.relativePath;
          [...prev, ...newRules].forEach(rule => {
            uniqueRules.set(getKey(rule), rule);
          });
          return Array.from(uniqueRules.values());
        });
      }
  
      setHasNextPage(!!data?.pageInfo?.hasNextPage);
      setHasPreviousPage(!!data?.pageInfo?.hasPreviousPage);
      setEndCursor(data?.pageInfo?.endCursor ?? null);
      setStartCursor(data?.pageInfo?.startCursor ?? null);
      setTotalCount(data?.totalCount ?? 0);
    } catch (error) {
      console.error("Failed to fetch rules:", error);
    } finally {
      setLoading(false);
    }
  };

  // Debounce search filter
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(filter);
    }, 500);

    return () => clearTimeout(timer);
  }, [filter]);

  // Initial load
  useEffect(() => {
    fetchRules();
  }, []);

  // Refetch when debounced filter changes
  useEffect(() => {
    if (debouncedFilter !== filter) return; // Only when debounce is complete
    
    const isSearch = debouncedFilter.trim().length > 0;
    setIsSearchMode(isSearch);
    setCurrentPage(1);
    setEndCursor(null);
    setStartCursor(null);
    
    fetchRules(debouncedFilter, undefined, undefined, true);
  }, [debouncedFilter]);

  // Comprehensive client-side search function
  const searchInText = (text: string, searchTerm: string): boolean => {
    const normalizedText = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    const normalizedSearch = searchTerm.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    
    // Split search term into words
    const searchWords = normalizedSearch.split(/\s+/).filter(word => word.length > 0);
    
    // Check if all search words are found in the text (permissive matching)
    return searchWords.every(word => 
      normalizedText.includes(word) || 
      // Allow partial matches for words longer than 2 characters
      (word.length > 2 && normalizedText.split(/\s+/).some(textWord => 
        textWord.includes(word) || word.includes(textWord)
      ))
    );
  };

  // Client-side filtering with comprehensive search
  const filteredRules = useMemo(() => {
    if (!debouncedFilter.trim()) return allRules;
    
    const searchTerm = debouncedFilter.trim();
    return allRules.filter(rule => 
      searchInText(rule.title, searchTerm) ||
      searchInText(rule.uri, searchTerm) ||
      searchInText(rule._sys.relativePath, searchTerm)
    );
  }, [allRules, debouncedFilter]);

  // Paginate filtered results for display
  const paginatedRules = useMemo(() => {
    if (!isSearchMode) return filteredRules;
    
    const startIndex = (currentPage - 1) * RULES_PER_PAGE;
    return filteredRules.slice(startIndex, startIndex + RULES_PER_PAGE);
  }, [filteredRules, currentPage, isSearchMode]);

  const displayRules = isSearchMode ? paginatedRules : filteredRules;

  const handleRuleSelect = (rule: Rule) => {
    const rulePath = `public/uploads/rules/${rule._sys.relativePath}`;
    input.onChange(rulePath);
  };

  const handleClearSelection = () => {
    input.onChange("");
  };

  const handleNextPage = () => {
    if (isSearchMode) {
      if (currentPage * RULES_PER_PAGE < filteredRules.length) {
        setCurrentPage(prev => prev + 1);
      }
    } else {
      if (hasNextPage && endCursor) {
        setCurrentPage(prev => prev + 1);
        fetchRules("", endCursor);
      }
    }
  };

  const handlePreviousPage = () => {
    if (isSearchMode) {
      // Client-side pagination for search results
      if (currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
    } else {
      // Server-side pagination for normal browsing
      if (hasPreviousPage && startCursor) {
        setCurrentPage(prev => Math.max(1, prev - 1));
        fetchRules("", undefined, startCursor);
      }
    }
  };

  // Find the selected rule details for display
  const selectedRuleDetails = useMemo(() => {
    if (!selectedRule) return null;
    const rel = selectedRule.startsWith('rules/')
      ? selectedRule.slice('rules/'.length)
      : selectedRule;
    return allRules.find(rule => rule._sys.relativePath === rel) || null;
  }, [selectedRule, allRules]);

  const labelText = selectedRuleDetails 
    ? selectedRuleDetails.title
    : selectedRule 
      ? selectedRule.split('/').at(-1)?.replace('.mdx', '') || "Selected rule"
      : "Select a rule";

  return (
    <div className="relative z-[1000]">
      <input type="hidden" id={input.name} {...input} />
      <Popover>
        {({ open }) => (
          <>
            <PopoverButton
              className="text-sm h-11 px-4 justify-between w-full bg-white border border-gray-200 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors flex items-center"
            >
              <span>{labelText}</span>
              <BiChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </PopoverButton>
            <div
              className="absolute w-full min-w-[600px] max-w-4xl -bottom-2 left-0 translate-y-full z-[1000]"
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
                    <div className="max-h-[400px] flex flex-col w-full">
                      {/* Search header */}
                      <div className="bg-gray-50 p-3 border-b border-gray-100 z-10 shadow-sm">
                        <div className="relative">
                          <BiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            className="bg-white text-sm rounded-sm border border-gray-100 shadow-inner py-2 pl-10 pr-3 w-full block placeholder-gray-400"
                            onClick={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                            }}
                            value={filter}
                            onChange={(event) => {
                              setFilter(event.target.value);
                            }}
                            placeholder="Search rules..."
                          />
                        </div>
                        {selectedRule && (
                          <div className="mt-2 flex justify-between items-center">
                            <span className="text-xs text-gray-600">
                              Current: {selectedRuleDetails?.title || "Selected rule"}
                            </span>
                            <button
                              onClick={handleClearSelection}
                              className="text-xs text-blue-500 hover:text-blue-700"
                            >
                              Clear selection
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Loading state */}
                      {loading && (
                        <div className="p-4 text-center text-gray-500">
                          Loading rules...
                        </div>
                      )}

                      {/* Empty state */}
                      {!loading && displayRules.length === 0 && (
                        <div className="p-4 text-center text-gray-400">
                          {filter ? "No rules found matching your search" : "No rules available"}
                        </div>
                      )}

                      {/* Rules list */}
                      {!loading && displayRules.length > 0 && (
                        <div className="flex-1 overflow-y-auto">
                          {displayRules.map((rule) => {
                            const rulePath = `rules/${rule._sys.relativePath}`;
                            const isSelected = selectedRule === rulePath;
                            
                            return (
                              <button
                                key={rule.id || rule._sys.relativePath}
                                className={`w-full text-left p-4 hover:bg-gray-50 border-b border-gray-100 transition-colors block ${
                                  isSelected ? 'bg-blue-50 border-blue-200' : ''
                                }`}
                                onClick={() => {
                                  handleRuleSelect(rule);
                                  close();
                                }}
                              >
                                <div className="flex items-start space-x-3 w-full">
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="font-medium text-gray-900 text-sm leading-5 mb-1 break-words">
                                      {rule.title}
                                    </div>
                                    <div className="text-xs text-gray-500 leading-4 break-words">
                                      {rule.uri}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Pagination footer */}
                      {!loading && displayRules.length > 0 && (
                        <div className="bg-gray-50 p-3 border-t border-gray-100 flex items-center justify-between">
                          <div className="text-xs text-gray-600">
                            {isSearchMode ? (
                              <>Page {currentPage} • {filteredRules.length} results found</>
                            ) : (
                              <>Page {currentPage} • {totalCount} total rules</>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={handlePreviousPage}
                              disabled={isSearchMode ? currentPage === 1 : !hasPreviousPage}
                              className={`p-1 rounded ${
                                (isSearchMode ? currentPage > 1 : hasPreviousPage)
                                  ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-200' 
                                  : 'text-gray-300 cursor-not-allowed'
                              }`}
                            >
                              <BiChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleNextPage}
                              disabled={isSearchMode ? (currentPage * RULES_PER_PAGE >= filteredRules.length) : !hasNextPage}
                              className={`p-1 rounded ${
                                (isSearchMode ? (currentPage * RULES_PER_PAGE < filteredRules.length) : hasNextPage)
                                  ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-200' 
                                  : 'text-gray-300 cursor-not-allowed'
                              }`}
                            >
                              <BiChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
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