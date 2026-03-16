"use client";

import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BiChevronDown, BiSearch, BiX } from "react-icons/bi";
import { wrapFieldsWithMeta } from "tinacms";

interface CategoryItem {
  title: string;
  _sys: { relativePath: string };
}

interface CategoryEntry {
  category: string; // e.g. "categories/azure-devops/branch-policies.mdx"
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Fetch categories from the API */
const fetchCategories = async (): Promise<CategoryItem[]> => {
  const res = await fetch(`${basePath}/api/categories`, { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data?.categories ?? [];
};


const CategoryMultiSelectorInner: React.FC<any> = ({ input, tinaForm }) => {
  const [filter, setFilter] = useState("");
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const shouldHide = tinaForm?.crudType === "create";

  // ── Derived state ───────────────────────────────────────────────────────────
  const selectedEntries: CategoryEntry[] = useMemo(() => (Array.isArray(input.value) ? input.value : []), [input.value]);
  const selectedPaths = useMemo(() => new Set(selectedEntries.map((e) => e.category)), [selectedEntries]);

  const filteredCategories = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? allCategories.filter((c) => (c.title || "").toLowerCase().includes(q)) : allCategories;
  }, [filter, allCategories]);

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setAllCategories(await fetchCategories());
      } catch (e) {
        console.error("Failed to load categories:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleCategory = useCallback(
    (category: CategoryItem) => {
      const path = `categories/${category._sys.relativePath}`;
      if (selectedPaths.has(path)) {
        input.onChange(selectedEntries.filter((e) => e.category !== path));
      } else {
        input.onChange([...selectedEntries, { category: path }]);
      }
    },
    [selectedPaths, selectedEntries, input],
  );

  const removeCategory = useCallback(
    (path: string) => input.onChange(selectedEntries.filter((e) => e.category !== path)),
    [selectedEntries, input],
  );

  const getLabelForPath = useCallback(
    (catPath: string) => {
      const rel = catPath.replace(/^categories\//, "");
      return allCategories.find((c) => c._sys.relativePath === rel)?.title ?? rel.replace(".mdx", "").split("/").at(-1) ?? catPath;
    },
    [allCategories],
  );

  const triggerLabel =
    selectedEntries.length === 0 ? "Select categories" : selectedEntries.length === 1 ? "1 category selected" : `${selectedEntries.length} categories selected`;

  // ── Render ──────────────────────────────────────────────────────────────────
  if (shouldHide) return <div style={{ display: "none" }} />;

  if (loading) return <div className="p-4 text-center text-gray-500 text-sm">Loading categories...</div>;

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      {selectedEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedEntries.map((entry) => {
            const label = getLabelForPath(entry.category);
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
                        {/* Search header */}
                        <div className="bg-gray-50 p-2 border-b border-gray-100 z-10 shadow-sm">
                          <div className="relative">
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
                        </div>

                        {/* Category list */}
                        {!loading && filteredCategories.length === 0 && <div className="p-4 text-center text-gray-400 text-sm">No categories found</div>}
                        {!loading && filteredCategories.length > 0 && (
                          <div className="flex-1 overflow-y-auto">
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
