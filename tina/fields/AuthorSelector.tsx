"use client";

import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import React, { useEffect, useMemo, useState } from "react";
import { BiChevronDown, BiSearch, BiUser } from "react-icons/bi";
import { wrapFieldsWithMeta } from "tinacms";

interface EmployeeItem {
  userId: string;
  fullName: string;
  jobTitle: string;
  gitHubUrl: string;
}

/**
 * Custom TinaCMS field component for the author `title` field.
 */
const AuthorSelectorInner: React.FC<any> = (props) => {
  const { field, input, form, tinaForm } = props;

  const [filter, setFilter] = useState("");
  const [allEmployees, setAllEmployees] = useState<EmployeeItem[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNonSsw, setIsNonSsw] = useState(false);

  // Derive the sibling `url` field name from our own `input.name`.
  const urlFieldName = useMemo(() => {
    return input.name.replace(/\.title$/, ".url");
  }, [input.name]);

  const updateUrlField = (value: string) => {
    const bracketName = urlFieldName.replace(/\.(\d+)\./g, "[$1].");

    // Approach 1: form prop (should be tinaForm.finalForm = the final-form API)
    if (typeof form?.change === "function") {
      form.change(urlFieldName, value);
      if (bracketName !== urlFieldName) {
        form.change(bracketName, value);
      }
    }

    // Approach 2: tinaForm.finalForm (TinaCMS form wrapper's final-form instance)
    if (typeof tinaForm?.finalForm?.change === "function") {
      tinaForm.finalForm.change(urlFieldName, value);
    }

    // Approach 3: tinaForm mutators (used internally by TinaCMS for list operations)
    if (typeof tinaForm?.change === "function") {
      tinaForm.change(urlFieldName, value);
    }

    console.log("[AuthorSelector] updateUrlField", {
      urlFieldName,
      bracketName,
      value,
      formHasChange: typeof form?.change === "function",
      tinaFormFinalFormHasChange: typeof tinaForm?.finalForm?.change === "function",
    });
  };

  // Read the current URL value so we can initialise the non‑SSW toggle state.
  const currentUrl: string = form?.getState?.()?.values ? (getNestedValue(form.getState().values, urlFieldName) ?? "") : "";

  useEffect(() => {
    if (currentUrl && !currentUrl.includes("ssw.com.au/people")) {
      setIsNonSsw(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch employees once on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      setError(null);
      try {
        const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
        const url = `${base}/api/crm/employees`;

        const res = await fetch(url, { method: "GET", cache: "no-store" });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
        }

        const data = await res.json();

        if (data?.error) {
          throw new Error(data.error);
        }

        const items: EmployeeItem[] = (data?.value ?? [])
          .filter((e: EmployeeItem) => e.fullName)
          .sort((a: EmployeeItem, b: EmployeeItem) => a.fullName.localeCompare(b.fullName));
        setAllEmployees(items);
      } catch (e: any) {
        console.error("Failed to load SSW employees:", e);
        setError(`Could not load SSW people list: ${e?.message || "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    const q = filter.trim().toLowerCase();
    if (!q) {
      setFilteredEmployees(allEmployees);
      return;
    }
    setFilteredEmployees(allEmployees.filter((e) => e.fullName.toLowerCase().includes(q)));
  }, [filter, allEmployees]);

  const handleSelectEmployee = (employee: EmployeeItem, close: () => void) => {
    input.onChange(employee.fullName);

    const slug = employee.fullName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const sswUrl = `https://www.ssw.com.au/people/${slug}`;

    // Set the sibling url field
    updateUrlField(sswUrl);

    close();
  };

  const handleSwitchToNonSsw = () => {
    setIsNonSsw(true);
    updateUrlField("");
  };

  const handleSwitchToSsw = () => {
    setIsNonSsw(false);
    updateUrlField("");
  };

  // ── Non‑SSW mode: plain text input ──────────────────────────────────────
  if (isNonSsw) {
    return (
      <div>
        <input
          type="text"
          id={input.name}
          className="mb-2 w-full bg-white text-sm rounded-full border border-gray-200 shadow-inner py-2 px-4 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={input.value || ""}
          onChange={(e) => input.onChange(e.target.value)}
          placeholder="Enter author name"
        />
        <button type="button" onClick={handleSwitchToSsw} className="block text-xs text-blue-600 hover:text-blue-800 underline transition-colors">
          ← Select from SSW people
        </button>
      </div>
    );
  }

  // ── SSW mode: searchable dropdown ───────────────────────────────────────
  return (
    <div>
      <div className="relative" style={{ zIndex: 9999 }}>
        <Popover>
          {({ open }) => (
            <>
              <PopoverButton
                className="text-sm h-11 px-4 justify-between w-full bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors flex items-center hover:bg-gray-50"
                title={input.value || undefined}
              >
                <span className="truncate flex items-center gap-2">
                  {input.value ? (
                    <>
                      <BiUser className="w-4 h-4 text-gray-500 shrink-0" />
                      {input.value}
                    </>
                  ) : (
                    <span className="text-gray-400">Select an SSW person</span>
                  )}
                </span>
                <BiChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
              </PopoverButton>

              <div className="absolute inset-x-0 mt-1" style={{ zIndex: 9999 }}>
                <Transition
                  enter="transition duration-150 ease-out"
                  enterFrom="transform opacity-0 -translate-y-2"
                  enterTo="transform opacity-100 translate-y-0"
                  leave="transition duration-75 ease-in"
                  leaveFrom="transform opacity-100 translate-y-0"
                  leaveTo="transform opacity-0 -translate-y-2"
                >
                  <PopoverPanel
                    className="overflow-hidden rounded-lg shadow-lg border border-gray-200"
                    style={{ zIndex: 9999, backgroundColor: "white", position: "relative" }}
                  >
                    {({ close }) => (
                      <div className="max-h-[50vh] flex flex-col w-full" style={{ backgroundColor: "white" }}>
                        <div className="p-2 border-b border-gray-100 shadow-sm" style={{ backgroundColor: "#f9fafb" }}>
                          <div className="relative">
                            <BiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              className="text-sm rounded-sm border border-gray-100 shadow-inner py-1.5 pl-10 pr-3 w-full block placeholder-gray-400"
                              style={{ backgroundColor: "white" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              value={filter}
                              onChange={(e) => setFilter(e.target.value)}
                              placeholder="Search by name..."
                            />
                          </div>
                        </div>

                        {loading && (
                          <div className="p-4 text-center text-gray-500 text-sm" style={{ backgroundColor: "white" }}>
                            Loading SSW people...
                          </div>
                        )}

                        {error && (
                          <div className="p-4 text-center text-red-500 text-sm" style={{ backgroundColor: "white" }}>
                            {error}
                          </div>
                        )}

                        {!loading && !error && filteredEmployees.length === 0 && (
                          <div className="p-4 text-center text-gray-400 text-sm" style={{ backgroundColor: "white" }}>
                            No matching people found
                          </div>
                        )}

                        {!loading && !error && filteredEmployees.length > 0 && (
                          <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "white" }}>
                            {filteredEmployees.map((employee) => {
                              const isSelected = input.value === employee.fullName;
                              return (
                                <button
                                  key={employee.userId}
                                  type="button"
                                  className={`w-full text-left py-2 px-3 border-b border-gray-100 transition-colors block ${isSelected ? "border-blue-200" : ""}`}
                                  style={{ backgroundColor: isSelected ? "#eff6ff" : "white" }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f9fafb";
                                  }}
                                  onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = isSelected ? "#eff6ff" : "white";
                                  }}
                                  onClick={() => handleSelectEmployee(employee, close)}
                                  title={employee.fullName}
                                >
                                  <div className="flex items-center gap-2">
                                    <BiUser className="w-4 h-4 text-gray-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-gray-900 text-sm leading-5 truncate">{employee.fullName}</div>
                                      {employee.jobTitle && <div className="text-xs text-gray-500 truncate">{employee.jobTitle}</div>}
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

      <button type="button" onClick={handleSwitchToNonSsw} className="mt-2 block text-xs text-blue-600 hover:text-blue-800 underline transition-colors">
        Not from SSW? Enter manually →
      </button>
    </div>
  );
};

export const AuthorSelectorInput = wrapFieldsWithMeta(AuthorSelectorInner);

/** Read a nested value from an object using a dot/bracket path like "authors[0].url" */
function getNestedValue(obj: any, path: string): any {
  const parts = path.replace(/\[(\d+)]/g, ".$1").split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}
