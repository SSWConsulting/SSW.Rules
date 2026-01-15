"use client";

import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import React, { useEffect, useMemo, useState } from "react";
import { BiChevronDown, BiSearch } from "react-icons/bi";

interface CategoryItem {
  title: string;
  _sys: {
    relativePath: string; // e.g. "azure-devops/branch-policies.mdx"
  };
}

const PROTECTED_BRANCHES = ["main", "tina-migration-main-content"];

export const CategorySelectorInput: React.FC<any> = (props) => {
  const { field, input, meta, form, tinaForm } = props;
  const [filter, setFilter] = useState("");
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | null>(null);
  const [isProtectedBranch, setIsProtectedBranch] = useState<boolean | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [revalidating, setRevalidating] = useState(false);
  const [revalidateStatus, setRevalidateStatus] = useState<string | null>(null);
  const [refetching, setRefetching] = useState(false);

  const selectedValue = useMemo(() => {
    return input.value || null;
  }, [input.value]);

  // If creating a new rule, disable the selector
  const isDisabled = isProtectedBranch === true;

  // Determine current branch and fetch categories
  useEffect(() => {
    // Don't fetch if creating a new rule
    const run = async () => {
      setLoading(true);
      try {
        // First, check branch status
        let branchProtected = false;
        try {
          const branchRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/branch`, { method: "GET", cache: "no-store" });
          if (branchRes.ok) {
            const branchData = await branchRes.json();
            const branch = branchData?.branch || "";
            setCurrentBranch(branch || "main");
            branchProtected = !!branch && PROTECTED_BRANCHES.includes(branch);
          } else {
            setCurrentBranch("main");
          }
        } catch (branchError) {
          // If branch check fails, assume not protected and continue
          console.warn("Failed to check branch status, proceeding with category fetch:", branchError);
          setCurrentBranch("main");
        }

        setIsProtectedBranch(branchProtected);

        // If branch is protected, don't fetch categories
        if (branchProtected) {
          setAllCategories([]);
          setFilteredCategories([]);
          return;
        }

        // Fetch categories via API route
        const categoriesRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/categories`, { method: "GET", cache: "no-store" });
        if (!categoriesRes.ok) {
          throw new Error(`HTTP ${categoriesRes.status}`);
        }
        const categoriesData = await categoriesRes.json();
        const items: CategoryItem[] = categoriesData?.categories || [];
        console.log("categoriesRes", items);

        setAllCategories(items);
      } catch (e) {
        console.error("Failed to load categories:", e);
        // On error, assume not protected so UI isn't blocked
        setIsProtectedBranch(false);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // Initialize selected category label from existing value when categories load
  useEffect(() => {
    if (!selectedValue || allCategories.length === 0) {
      return;
    }

    // Extract the relative path from the selected value
    const selectedRel = selectedValue.replace(/^public\/uploads\/categories\//, "").replace(/^categories\//, "");

    // Find the matching category
    const matchingCategory = allCategories.find((c) => c._sys.relativePath === selectedRel);

    // Only update if we found a match and the label doesn't already match
    if (matchingCategory && selectedCategoryLabel !== matchingCategory.title) {
      setSelectedCategoryLabel(matchingCategory.title);
    } else if (!matchingCategory && selectedCategoryLabel) {
      // If value exists but no matching category found, clear the label
      setSelectedCategoryLabel(null);
    }
  }, [selectedValue, allCategories, selectedCategoryLabel]);

  useEffect(() => {
    const q = filter.trim().toLowerCase();
    const includesMatches = allCategories.filter((c) => (c.title || "").toLowerCase().includes(q));

    // If no query, show all categories; otherwise show matches
    setFilteredCategories(q ? includesMatches : allCategories);
  }, [filter, allCategories]);

  const handleCategorySelect = (category: CategoryItem) => {
    setSelectedCategoryLabel(category.title);
    const categoryPath = `categories/${category._sys.relativePath}`;
    input.onChange(categoryPath);
  };

  const refetchCategories = async () => {
    try {
      setRefetching(true);
      const categoriesRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/categories`, { method: "GET", cache: "no-store" });
      if (!categoriesRes.ok) {
        throw new Error(`HTTP ${categoriesRes.status}`);
      }
      const categoriesData = await categoriesRes.json();
      const items: CategoryItem[] = categoriesData?.categories || [];
      setAllCategories(items);
    } catch (e) {
      console.error("Failed to refetch categories:", e);
    } finally {
      setRefetching(false);
    }
  };

  const handleRevalidate = async () => {
    if (!currentBranch) return;

    setRevalidating(true);
    setRevalidateStatus(null);

    try {
      const branchName = currentBranch || "main";
      const tag = `branch-${branchName}-categories`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/revalidate-tag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tag }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setRevalidateStatus("Successfully refreshed categories");
        // Refetch categories after revalidation
        await refetchCategories();
      } else {
        setRevalidateStatus(`Failed: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to revalidate tag:", error);
      setRevalidateStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setRevalidating(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading categories...</div>;
  }

  return (
    <div className="relative z-1000">
      <input type="hidden" id={input.name} {...input} />
      <Popover>
        {({ open }) => (
          <>
            <PopoverButton
              disabled={isDisabled}
              className={`text-sm h-11 px-4 justify-between w-full bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors flex items-center ${
                isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
              }`}
              title={selectedCategoryLabel || undefined}
            >
              <span className="truncate" title={selectedCategoryLabel || undefined}>
                {selectedCategoryLabel || "Select a category"}
              </span>
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
                        <div className="relative mb-2">
                          <BiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            className="bg-white text-sm rounded-sm border border-gray-100 shadow-inner py-1.5 pl-10 pr-3 w-full block placeholder-gray-400"
                            disabled={isDisabled}
                            onClick={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                            }}
                            value={filter}
                            onChange={(event) => {
                              setFilter(event.target.value);
                            }}
                            placeholder="Enter category path, e.g. azure-devops/branch-policies"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleRevalidate();
                          }}
                          disabled={revalidating || isDisabled || !currentBranch}
                          className="w-full text-xs px-3 py-1.5 bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {revalidating ? "Revalidating..." : "Revalidate Cache"}
                        </button>
                        {revalidateStatus && (
                          <div
                            className={`mt-1 text-xs px-2 py-1 rounded ${revalidateStatus.includes("Successfully") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                          >
                            {revalidateStatus}
                          </div>
                        )}
                      </div>

                      {/* Refetching indicator */}
                      {refetching && <div className="p-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 text-center">Refreshing categories...</div>}

                      {/* Empty state */}
                      {!loading && !isDisabled && filteredCategories.length === 0 && <div className="p-4 text-center text-gray-400">No categories found</div>}

                      {/* Category list */}
                      {!loading && !isDisabled && filteredCategories.length > 0 && (
                        <div className={`flex-1 overflow-y-auto ${refetching ? "opacity-50 pointer-events-none" : ""}`}>
                          {filteredCategories.map((category) => {
                            const selectedRel = selectedValue ? selectedValue.replace(/^public\/uploads\/categories\//, "").replace(/^categories\//, "") : null;
                            const isSelected = selectedRel === category._sys.relativePath;

                            return (
                              <button
                                key={`${category._sys.relativePath}`}
                                className={`w-full text-left py-2 px-3 hover:bg-gray-50 border-b border-gray-100 transition-colors block ${
                                  isSelected ? "bg-blue-50 border-blue-200" : ""
                                }`}
                                onClick={() => {
                                  handleCategorySelect(category);
                                  close();
                                }}
                                title={category.title}
                              >
                                <div className="flex items-center justify-between w-full gap-3">
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="font-medium text-gray-900 text-sm leading-5 truncate" title={category.title}>
                                      {category.title}
                                    </div>
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
            {isDisabled && <div className="mt-1 text-xs text-gray-400">{"Switch to a non-protected branch to enable category selection."}</div>}
          </>
        )}
      </Popover>
    </div>
  );
};
