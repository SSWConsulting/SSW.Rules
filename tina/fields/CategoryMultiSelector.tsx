"use client";

import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BiChevronDown, BiRefresh, BiSearch, BiX } from "react-icons/bi";
import { wrapFieldsWithMeta } from "tinacms";

interface CategoryItem {
  title: string;
  _sys: {
    relativePath: string; // e.g. "azure-devops/branch-policies.mdx"
  };
}

/** Shape of each entry in the `categories` array stored in the rule front matter */
interface CategoryEntry {
  category: string; // e.g. "categories/azure-devops/branch-policies.mdx"
}

const CategoryMultiSelectorInner: React.FC<any> = (props) => {
  const { field, input, form, tinaForm } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState("");
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [revalidating, setRevalidating] = useState(false);
  const [revalidateStatus, setRevalidateStatus] = useState<string | null>(null);
  const [refetching, setRefetching] = useState(false);

  // ── Determine whether the field should be hidden (create mode) ──────────────
  const shouldHide = tinaForm?.crudType === "create";

  // Hide the outer label wrapper that wrapFieldsWithMeta adds
  useEffect(() => {
    if (!containerRef.current) return;

    let el: HTMLElement | null = containerRef.current;
    for (let depth = 0; depth < 6 && el; depth++) {
      el = el.parentElement;
      if (!el) break;
      const allLabels = el.querySelectorAll("label");
      for (const label of Array.from(allLabels)) {
        if (!containerRef.current?.contains(label)) {
          (label as HTMLElement).style.display = shouldHide ? "none" : "";
          return;
        }
      }
    }
  }, [shouldHide]);

  // ── Derive selected categories from input.value ─────────────────────────────
  const selectedEntries: CategoryEntry[] = useMemo(() => {
    const val = input.value;
    if (!val || !Array.isArray(val)) return [];
    return val as CategoryEntry[];
  }, [input.value]);

  const selectedPaths = useMemo(() => new Set(selectedEntries.map((e) => e.category)), [selectedEntries]);

  // ── Fetch categories on mount ───────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        try {
          const branchRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/branch`, { method: "GET", cache: "no-store" });
          if (branchRes.ok) {
            const branchData = await branchRes.json();
            setCurrentBranch(branchData?.branch || "main");
          } else {
            setCurrentBranch("main");
          }
        } catch {
          setCurrentBranch("main");
        }

        const categoriesRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/categories`, { method: "GET", cache: "no-store" });
        if (!categoriesRes.ok) throw new Error(`HTTP ${categoriesRes.status}`);
        const categoriesData = await categoriesRes.json();
        setAllCategories(categoriesData?.categories || []);
      } catch (e) {
        console.error("Failed to load categories:", e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // ── Filter list on search ───────────────────────────────────────────────────
  useEffect(() => {
    const q = filter.trim().toLowerCase();
    setFilteredCategories(q ? allCategories.filter((c) => (c.title || "").toLowerCase().includes(q)) : allCategories);
  }, [filter, allCategories]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const refetchCategories = async () => {
    try {
      setRefetching(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/categories`, { method: "GET", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAllCategories(data?.categories || []);
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
      const tag = `branch-${currentBranch}-categories`;
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/revalidate-tag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setRevalidateStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setRevalidating(false);
    }
  };

  const toggleCategory = (category: CategoryItem) => {
    const path = `categories/${category._sys.relativePath}`;
    if (selectedPaths.has(path)) {
      // Remove
      input.onChange(selectedEntries.filter((e) => e.category !== path));
    } else {
      // Add
      input.onChange([...selectedEntries, { category: path }]);
    }
  };

  const removeCategory = (path: string) => {
    input.onChange(selectedEntries.filter((e) => e.category !== path));
  };

  // ── Button label ────────────────────────────────────────────────────────────
  const triggerLabel =
    selectedEntries.length === 0 ? "Select categories" : selectedEntries.length === 1 ? "1 category selected" : `${selectedEntries.length} categories selected`;

  // ── Render ──────────────────────────────────────────────────────────────────
  if (shouldHide) {
    return <div ref={containerRef} style={{ display: "none" }} />;
  }

  if (loading) {
    return (
      <div ref={containerRef}>
        <div className="p-4 text-center text-gray-500 text-sm">Loading categories...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Selected chips */}
      {selectedEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedEntries.map((entry) => {
            const rel = entry.category.replace(/^categories\//, "");
            const matched = allCategories.find((c) => c._sys.relativePath === rel);
            const label = matched?.title ?? rel.replace(".mdx", "").split("/").at(-1) ?? entry.category;
            return (
              <span key={entry.category} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {label}
                <button
                  type="button"
                  onClick={() => removeCategory(entry.category)}
                  className="ml-0.5 rounded-full hover:bg-blue-200 focus:outline-none"
                  title={`Remove ${label}`}
                >
                  <BiX className="w-3.5 h-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Popover trigger + panel */}
      <div className="relative z-[1000]">
        <input type="hidden" id={input.name} name={input.name} />
        <Popover>
          {({ open }) => (
            <>
              <PopoverButton
                className="text-sm h-11 px-4 justify-between w-full bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors flex items-center hover:bg-gray-50"
                title={triggerLabel}
              >
                <span className="truncate text-gray-700">{triggerLabel}</span>
                <BiChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
              </PopoverButton>

              <div className="absolute inset-x-0 -bottom-2 translate-y-full z-[1000]">
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
                        {/* Search + refresh header */}
                        <div className="bg-gray-50 p-2 border-b border-gray-100 z-10 shadow-sm">
                          <div className="relative mb-2">
                            <BiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              className="bg-white text-sm rounded-sm border border-gray-100 shadow-inner py-1.5 pl-10 pr-3 w-full block placeholder-gray-400"
                              value={filter}
                              onChange={(e) => setFilter(e.target.value)}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              placeholder="Search categories..."
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
                            title="The category list may be showing stale data. Click to refresh and fetch the most up-to-date list."
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

                        {/* Refreshing indicator */}
                        {refetching && <div className="p-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 text-center">Refreshing categories...</div>}

                        {/* Category list */}
                        {!loading && filteredCategories.length === 0 && <div className="p-4 text-center text-gray-400 text-sm">No categories found</div>}
                        {!loading && filteredCategories.length > 0 && (
                          <div className={`flex-1 overflow-y-auto ${refetching ? "opacity-50 pointer-events-none" : ""}`}>
                            {filteredCategories.map((category) => {
                              const path = `categories/${category._sys.relativePath}`;
                              const isSelected = selectedPaths.has(path);
                              return (
                                <button
                                  key={category._sys.relativePath}
                                  type="button"
                                  className={`w-full text-left py-2 px-3 border-b border-gray-200 transition-colors flex items-center gap-2.5 bg-gray-100 hover:bg-gray-200 ${
                                    isSelected ? "border-l-2 border-l-blue-500" : ""
                                  }`}
                                  onClick={() => toggleCategory(category)}
                                  title={category.title}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    readOnly
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600 flex-shrink-0 pointer-events-none"
                                  />
                                  <span className="font-medium text-gray-900 text-sm leading-5 truncate">{category.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Done button */}
                        <div className="p-2 border-t border-gray-100 bg-gray-50">
                          <button
                            type="button"
                            onClick={() => close()}
                            className="w-full text-sm px-3 py-1.5 bg-gray-800 text-white rounded-sm hover:bg-gray-700 transition-colors"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </PopoverPanel>
                </Transition>
              </div>
            </>
          )}
        </Popover>
      </div>
    </div>
  );
};

export const CategoryMultiSelectorInput = wrapFieldsWithMeta(CategoryMultiSelectorInner);
