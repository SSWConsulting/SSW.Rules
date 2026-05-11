"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BiSearch, BiSolidError, BiUser, BiX } from "react-icons/bi";
import { wrapFieldsWithMeta } from "tinacms";
import { toSlug } from "@/lib/utils";

interface Employee {
  userId: string;
  fullName: string;
  jobTitle: string;
  isActive: boolean;
}

interface Author {
  title: string;
  url: string;
  img?: string;
}

/**
 * Custom list component for the `authors` field.
 *
 * Replaces TinaCMS's default list UI so that:
 * 1. Clicking "+ Add author" opens the picker inline immediately (no extra ✏️ click)
 * 2. Duplicate authors (by URL or name) are rejected
 * 3. Current SSW employees appear first; alumni appear below with an "Alumni" badge
 * 4. A "Not in SSW People? Enter manually →" mode supports external contributors
 * 5. Hides in TinaCMS create mode (mirrors ConditionalHiddenField behaviour)
 */
export const PeopleSelector = wrapFieldsWithMeta((props: any) => {
  const { input, tinaForm } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  const authors: Author[] = Array.isArray(input.value) ? input.value : [];

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [mode, setMode] = useState<"picker" | "manual">("picker");
  const [filter, setFilter] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualImg, setManualImg] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Hide in create mode — mirrors ConditionalHiddenField.
  useEffect(() => {
    if (tinaForm?.crudType !== "create") return;
    let element: HTMLElement | null = containerRef.current;
    for (let depth = 0; depth < 6 && element; depth++) {
      element = element.parentElement;
      if (!element) break;
      const hasLabel =
        element.querySelector("label") ||
        element.querySelector('[class*="label"]') ||
        element.getAttribute("data-tina-field");
      if (hasLabel || depth >= 3) {
        (element as HTMLElement).style.display = "none";
        break;
      }
    }
  }, [tinaForm?.crudType]);

  // Fetch SSW employees once on mount.
  useEffect(() => {
    const run = async () => {
      setLoadingEmployees(true);
      try {
        const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const res = await fetch(`${base}/api/crm/employees`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setEmployees((data.value ?? []).filter((e: Employee) => !!e.fullName));
      } catch (e) {
        console.error("PeopleSelector: failed to load employees", e);
      } finally {
        setLoadingEmployees(false);
      }
    };
    run();
  }, []);

  // Sort: current employees (isActive: true) first, alumni second — each group alphabetically.
  const sortedEmployees = useMemo(
    () =>
      [...employees].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.fullName.localeCompare(b.fullName);
      }),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sortedEmployees;
    return sortedEmployees.filter((e) => e.fullName.toLowerCase().includes(q));
  }, [filter, sortedEmployees]);

  const isDuplicate = (title: string, url: string) =>
    authors.some((a) => (url && a.url === url) || a.title.toLowerCase() === title.toLowerCase());

  const resetAddForm = () => {
    setIsAdding(false);
    setMode("picker");
    setFilter("");
    setManualTitle("");
    setManualUrl("");
    setManualImg("");
    setError(null);
  };

  const handleSelectEmployee = (employee: Employee) => {
    const url = `https://www.ssw.com.au/people/${toSlug(employee.fullName)}`;
    if (isDuplicate(employee.fullName, url)) {
      setError("This author has already been added.");
      return;
    }
    input.onChange([...authors, { title: employee.fullName, url }]);
    resetAddForm();
  };

  const handleAddManual = () => {
    const title = manualTitle.trim();
    if (!title) {
      setError("Contributor name is required.");
      return;
    }
    const url = manualUrl.trim();
    if (url) {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          setError("Profile URL must start with http:// or https://");
          return;
        }
      } catch {
        setError("Please enter a valid Profile URL (e.g. https://example.com)");
        return;
      }
    }
    if (isDuplicate(title, url)) {
      setError("This author has already been added.");
      return;
    }
    const newAuthor: Author = { title, url };
    if (manualImg.trim()) newAuthor.img = manualImg.trim();
    input.onChange([...authors, newAuthor]);
    resetAddForm();
  };

  const handleRemove = (index: number) => {
    setError(null);
    input.onChange(authors.filter((_, i) => i !== index));
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {/* ── Current authors ── */}
      {authors.map((author, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <BiUser className="h-4 w-4 shrink-0 text-gray-400" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-900">{author.title}</div>
            {author.url && <div className="truncate text-xs text-gray-500">{author.url}</div>}
          </div>
          <button
            type="button"
            className="shrink-0 text-gray-400 transition-colors hover:text-red-500"
            onClick={() => handleRemove(i)}
            title="Remove author"
          >
            <BiX className="h-4 w-4" />
          </button>
        </div>
      ))}

      {/* ── Error message ── */}
      {error && (
        <div className="flex items-center gap-1 text-sm text-red-600">
          <BiSolidError className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* ── Add author ── */}
      {!isAdding ? (
        <button
          type="button"
          className="mt-1 text-sm text-blue-600 transition-colors hover:text-blue-800"
          onClick={() => setIsAdding(true)}
        >
          + Add author
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          {mode === "picker" ? (
            /* ── SSW People picker ── */
            <div>
              <div className="relative mb-2">
                <BiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  className="w-full rounded border border-gray-200 bg-white py-1.5 pl-9 pr-3 text-sm placeholder-gray-400"
                  placeholder="Search SSW People…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>

              <div className="mb-2 max-h-48 overflow-y-auto rounded border border-gray-100">
                {loadingEmployees && <div className="p-3 text-center text-sm text-gray-400">Loading…</div>}
                {!loadingEmployees && filteredEmployees.length === 0 && (
                  <div className="p-3 text-center text-sm text-gray-400">No people found</div>
                )}
                {filteredEmployees.map((emp) => (
                  <button
                    key={emp.userId}
                    type="button"
                    className="flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm transition-colors last:border-0 hover:bg-gray-50"
                    onClick={() => handleSelectEmployee(emp)}
                  >
                    <BiUser className="h-4 w-4 shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-gray-900">{emp.fullName}</div>
                      {emp.jobTitle && <div className="truncate text-xs text-gray-500">{emp.jobTitle}</div>}
                    </div>
                    {!emp.isActive && (
                      <span className="shrink-0 rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        Alumni
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="text-xs text-gray-500 underline hover:text-gray-700"
                onClick={() => {
                  setMode("manual");
                  setError(null);
                }}
              >
                Not in SSW People? Enter manually →
              </button>
            </div>
          ) : (
            /* ── Manual entry ── */
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Contributor Name</label>
                <input
                  autoFocus
                  type="text"
                  className="w-full rounded border border-gray-200 bg-white px-3 py-1.5 text-sm placeholder-gray-400"
                  placeholder="Full name as it should appear on the rule"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddManual();
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Profile URL <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="url"
                  className="w-full rounded border border-gray-200 bg-white px-3 py-1.5 text-sm placeholder-gray-400"
                  placeholder="Full link to the contributor's profile"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddManual();
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Profile Image URL <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="url"
                  className="w-full rounded border border-gray-200 bg-white px-3 py-1.5 text-sm placeholder-gray-400"
                  placeholder="Photo URL for this contributor"
                  value={manualImg}
                  onChange={(e) => setManualImg(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="text-xs text-gray-500 underline hover:text-gray-700"
                onClick={() => {
                  setMode("picker");
                  setError(null);
                }}
              >
                ← Choose from SSW People
              </button>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            {mode === "manual" && (
              <button
                type="button"
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
                onClick={handleAddManual}
              >
                Add
              </button>
            )}
            <button
              type="button"
              className="px-3 py-1 text-sm text-gray-600 transition-colors hover:text-gray-800"
              onClick={resetAddForm}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
