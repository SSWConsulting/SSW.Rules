"use client";

import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import React, { useEffect, useMemo, useState } from "react";
import { BiChevronDown, BiRefresh, BiSearch } from "react-icons/bi";

interface CategoryItem {
  title: string;
  _sys: {
    relativePath: string; // e.g. "azure-devops/branch-policies.mdx"
  };
}

export const CategorySelectorInput: React.FC<any> = (props) => {
  const { field, input, meta, form, tinaForm } = props;
  const [filter, setFilter] = useState("");
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [revalidating, setRevalidating] = useState(false);
  const [revalidateStatus, setRevalidateStatus] = useState<string | null>(null);
  const [refetching, setRefetching] = useState(false);

  const selectedValue = useMemo(() => {
    return input.value || null;
  }, [input.value]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        try {
          const branchRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/branch`, { method: "GET", cache: "no-store" });
          if (branchRes.ok) {
            const branchData = await branchRes.json();
            const branch = branchData?.branch || "";
            setCurrentBranch(branch || "main");
          } else {
            setCurrentBranch("main");
          }
        } catch (branchError) {
          console.warn("Failed to check branch status, proceeding with category fetch:", branchError);
          setCurrentBranch("main");
        }

        const categoriesRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/categories`, { method: "GET", cache: "no-store" });
        if (!categoriesRes.ok) {
          throw new Error(`HTTP ${categoriesRes.status}`);
        }
        const categoriesData = await categoriesRes.json();
        const items: CategoryItem[] = categoriesData?.categories || [];
        setAllCategories(items);
      } catch (e) {
        console.error("Failed to load categories:", e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  useEffect(() => {
    if (!selectedValue || allCategories.length === 0) {
      return;
    }

    const selectedRel = selectedValue.replace(/^public\/uploads\/categories\//, "").replace(/^categories\//, "");

    const matchingCategory = allCategories.find((c) => c._sys.relativePath === selectedRel);

    if (matchingCategory && selectedCategoryLabel !== matchingCategory.title) {
      setSelectedCategoryLabel(matchingCategory.title);
    } else if (!matchingCategory && selectedCategoryLabel) {
      setSelectedCategoryLabel(null);
    }
  }, [selectedValue, allCategories, selectedCategoryLabel]);

  useEffect(() => {
    const q = filter.trim().toLowerCase();
    const includesMatches = allCategories.filter((c) => (c.title || "").toLowerCase().includes(q));

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
              disabled={false}
              className={`text-sm h-11 px-4 justify-between w-full bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors flex items-center hover:bg-gray-50`}
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
                      <div className="bg-gray-50 p-2 border-b border-gray-100 z-10 shadow-sm">
                        <div className="relative mb-2">
                          <BiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            className="bg-white text-sm rounded-sm border border-gray-100 shadow-inner py-1.5 pl-10 pr-3 w-full block placeholder-gray-400"
                            disabled={false}
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
                          disabled={revalidating || !currentBranch}
                          className="w-full text-xs px-3 py-1.5 bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                          title="The category list may be showing stale data. If you're not seeing the latest categories, click here to refresh and fetch the most up-to-date list."
                        >
                          <BiRefresh className={`w-4.5 h-4.5 ${revalidating ? "animate-spin" : ""}`} />
                          {revalidating ? "Refreshing..." : "Refresh Categories"}
                        </button>
                        {revalidateStatus && (
                          <div
                            className={`mt-1 text-xs px-2 py-1 rounded ${revalidateStatus.includes("Successfully") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                          >
                            {revalidateStatus}
                          </div>
                        )}
                      </div>
                      {refetching && <div className="p-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 text-center">Refreshing categories...</div>}
                      {!loading && filteredCategories.length === 0 && <div className="p-4 text-center text-gray-400">No categories found</div>}
                      {!loading && filteredCategories.length > 0 && (
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
          </>
        )}
      </Popover>
    </div>
  );
};
