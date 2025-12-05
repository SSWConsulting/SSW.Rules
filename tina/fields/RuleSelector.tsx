"use client";

import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import React, { useEffect, useMemo, useState } from "react";
import { BiChevronDown, BiSearch } from "react-icons/bi";

interface Rule {
  title: string;
  uri: string;
  lastUpdated: string;
  _sys: {
    relativePath: string;
  };
}

const MIN_SEARCH_LENGTH = 2;
const INITIAL_RULES_COUNT = 20;

export const RuleSelector: React.FC<any> = ({ input }) => {
  const [filter, setFilter] = useState("");
  const [allRules, setAllRules] = useState<Rule[]>([]);
  const [filteredRules, setFilteredRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedRuleLabel, setSelectedRuleLabel] = useState<string | null>(null);

  const selectedRule = useMemo(() => {
    return input.value || null;
  }, [input.value]);

  const formatLastUpdated = (value: string) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Fetch all rules once on mount (via API)
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        // Since we are in Tina admin site, we are at /admin so need to drop down a level back to root
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/rules`, { method: "GET", cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rules = await res.json();
        setAllRules(rules);
      } catch (e) {
        console.error("Failed to load all rules:", e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // Initialize selected rule label from input.value when rules are loaded
  useEffect(() => {
    if (allRules.length === 0 || !input.value) return;

    // Extract relative path from input.value (handles both "public/uploads/rules/" and "rules/" prefixes)
    const selectedRel = input.value.replace(/^public\/uploads\/rules\//, "").replace(/^rules\//, "");

    // Find the matching rule
    const matchingRule = allRules.find((r) => r._sys.relativePath === selectedRel);

    if (matchingRule) {
      setSelectedRuleLabel(matchingRule.uri);
    }
  }, [allRules, input.value]);

  // Recompute filtered results when query changes
  useEffect(() => {
    const q = filter.trim().toLowerCase();
    const isSearch = q.length >= MIN_SEARCH_LENGTH;

    if (!isSearch) {
      // Show first 20 rules sorted by lastUpdated when no search query
      // Ensure selected rule is always included if it exists
      const selectedRel = selectedRule ? selectedRule.replace(/^public\/uploads\/rules\//, "").replace(/^rules\//, "") : null;
      const selectedRuleObj = selectedRel ? allRules.find((r) => r._sys.relativePath === selectedRel) : null;

      const sorted = [...allRules].sort((a, b) => {
        const timeA = new Date(a.lastUpdated).getTime() || 0;
        const timeB = new Date(b.lastUpdated).getTime() || 0;
        return timeB - timeA;
      });

      // If there's a selected rule, ensure it's included
      if (selectedRuleObj) {
        const topRules = sorted.slice(0, INITIAL_RULES_COUNT);
        const isSelectedInTop = topRules.some((r) => r._sys.relativePath === selectedRel);

        if (!isSelectedInTop) {
          // Remove the last item and add selected rule at the top
          topRules.pop();
          setFilteredRules([selectedRuleObj, ...topRules]);
        } else {
          // Selected rule is already in top 20, just show top 20
          setFilteredRules(topRules);
        }
      } else {
        setFilteredRules(sorted.slice(0, INITIAL_RULES_COUNT));
      }
      return;
    }

    // Filter and sort when searching - show ALL matching results (no limit)
    const includesMatches = allRules.filter((r) => {
      const uri = r.uri.toLowerCase();
      const title = r.title.toLowerCase();
      return uri.includes(q) || title.includes(q);
    });
    const includesSorted = [...includesMatches].sort((a, b) => {
      const timeA = new Date(a.lastUpdated).getTime() || 0;
      const timeB = new Date(b.lastUpdated).getTime() || 0;
      return timeB - timeA;
    });
    // Show all matching results when searching (no limit)
    setFilteredRules(includesSorted);
  }, [filter, allRules, selectedRule]);

  const handleRuleSelect = (rule) => {
    setSelectedRuleLabel(rule.uri);
    const rulePath = `public/uploads/rules/${rule._sys.relativePath}`;
    input.onChange(rulePath);
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading rules...</div>;
  }

  return (
    <div className="relative z-1000">
      <input type="hidden" id={input.name} {...input} />
      <Popover>
        {({ open }) => (
          <>
            <PopoverButton className="text-sm h-11 px-4 justify-between w-full bg-white border border-gray-200 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors flex items-center">
              <span>{selectedRuleLabel || "Select a rule"}</span>
              <BiChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </PopoverButton>
            <div className="absolute inset-x-0 -bottom-2 translate-y-full z-1000">
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

                      {/* Empty state */}
                      {!loading && filteredRules.length === 0 && filter.length >= MIN_SEARCH_LENGTH && (
                        <div className="p-4 text-center text-gray-400">No rules found matching your search</div>
                      )}

                      {/* Rules list */}
                      {!loading && filteredRules.length > 0 && (
                        <div className="flex-1 overflow-y-auto">
                          {filteredRules.map((rule) => {
                            const selectedRel = selectedRule ? selectedRule.replace(/^public\/uploads\/rules\//, "").replace(/^rules\//, "") : null;
                            const isSelected = selectedRel === rule._sys.relativePath;

                            return (
                              <button
                                key={rule.uri}
                                className={`w-full text-left py-2 px-3 hover:bg-gray-50 border-b border-gray-100 transition-colors block ${
                                  isSelected ? "bg-blue-50 border-blue-200" : ""
                                }`}
                                onClick={() => {
                                  handleRuleSelect(rule);
                                  close();
                                }}
                              >
                                <div className="flex items-center justify-between w-full gap-3">
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="font-medium text-gray-900 text-sm leading-5 truncate">{rule.title}</div>
                                    <div className="text-xs text-gray-500 leading-4 truncate">{rule.uri}</div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
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
