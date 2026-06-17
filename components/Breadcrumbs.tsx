"use client";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { withBasePath } from "@/lib/withBasePath";
import { parentSiteUrl, siteUrlRelative } from "@/site-config";

interface BreadcrumbProps {
  categories?: { link: string; title: string }[];
  isCategory?: boolean;
  isHomePage?: boolean;
  breadcrumbText?: string;
  iconSrc?: string;
}

export default function Breadcrumbs({ categories, isCategory = false, isHomePage = false, breadcrumbText, iconSrc = "/uploads/icon.png" }: BreadcrumbProps) {
  const showCategories = typeof categories !== "undefined";
  const categoryList = showCategories && (categories?.length ?? 0) > 0 ? categories! : showCategories ? [{ link: "/orphaned", title: "Orphaned" }] : [];

  const tailText = breadcrumbText ?? (isCategory ? "This category" : "This rule");

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  // Mobile: show only the immediate parent (one level up) to avoid multi-line wrapping
  const immediateParent =
    categoryList.length > 0
      ? { link: categoryList[0].link, title: categoryList[0].title.replace(/Rules to(?: Better)?/i, "").trim() }
      : { link: siteUrlRelative, title: "SSW Rules" };

  return (
    <nav aria-label="Breadcrumb" className="m-4 mt-2">
      {/* Mobile: single line — icon + immediate parent only */}
      <div className="flex items-center gap-2 md:hidden">
        <a href={parentSiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center shrink-0">
          <img alt="SSW Foursquare" src={withBasePath(iconSrc)} width={16} height={16} className="block w-4 h-4" loading="lazy" decoding="async" />
        </a>
        {!isHomePage && (
          <>
            <span aria-hidden="true" className="text-gray-400 shrink-0">/</span>
            <Link
              href={immediateParent.link}
              className="truncate min-w-0 transition underline decoration-1 decoration-gray-400 underline-offset-2 duration-150 hover:text-ssw-red hover:decoration-ssw-red"
            >
              {immediateParent.title}
            </Link>
          </>
        )}
      </div>

      {/* Desktop: full trail, labels truncate at ~80 characters */}
      <div className="hidden md:grid grid-cols-[auto_1fr] gap-2 items-center">
        <a
          href={parentSiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center shrink-0 h-[1.5em]"
        >
          <img alt="SSW Foursquare" src={withBasePath(iconSrc)} width={16} height={16} className="block w-4 h-4" loading="lazy" decoding="async" />
          <span aria-hidden="true" className="ml-2 text-gray-400">/</span>
        </a>

        <ol className="flex min-w-0 list-none p-0 m-0 items-center">
          <li className="flex items-center mb-0 h-[1.5em] shrink-0">
            <Link
              href={siteUrlRelative}
              className="transition underline decoration-1 decoration-gray-400 underline-offset-2 duration-150 hover:text-ssw-red hover:decoration-ssw-red"
            >
              SSW Rules
            </Link>
          </li>

          {showCategories && categoryList.length > 1 ? (
            <li className="flex items-center mb-0 shrink-0">
              <span aria-hidden="true" className="mx-4 text-gray-400">/</span>
              <div className="relative group" ref={dropdownRef}>
                <button
                  ref={triggerRef}
                  className="inline-flex items-center gap-1 cursor-pointer underline decoration-1 decoration-gray-400 underline-offset-2 bg-transparent border-0 p-0 font-inherit text-inherit"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsDropdownOpen(false);
                      triggerRef.current?.focus();
                    }
                  }}
                  aria-haspopup="menu"
                  aria-expanded={isDropdownOpen}
                >
                  Multiple categories
                  <svg
                    aria-hidden
                    width={14}
                    height={14}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <div className={`absolute -left-4 top-full z-10 bg-white border border-gray-200 rounded shadow-md w-max max-w-[min(20rem,calc(100vw-2rem))] ${isDropdownOpen ? "block" : "hidden md:group-hover:block"}`}>
                  <ul role="menu" className="list-none m-0 py-1 px-0">
                    {categoryList.map((cat, i) => (
                      <li key={i} role="none" className="mb-0">
                        <Link role="menuitem" href={cat.link} className="block px-4 py-2 transition hover:text-ssw-red">
                          {cat.title.replace(/Rules to(?: Better)?/i, "").trim()}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ) : (
            showCategories &&
            categoryList.map((cat, i) => (
              <li key={i} className="flex items-center mb-0 min-w-0">
                <span aria-hidden="true" className="mx-4 text-gray-400 shrink-0">/</span>
                <Link
                  href={cat.link}
                  className="truncate min-w-0 max-w-[80ch] transition underline decoration-1 decoration-gray-400 underline-offset-2 duration-150 hover:text-ssw-red hover:decoration-ssw-red"
                >
                  {cat.title.replace(/Rules to(?: Better)?/i, "").trim()}
                </Link>
              </li>
            ))
          )}

          {!isHomePage && (
            <li className="flex items-center mb-0 min-w-0" aria-current="page">
              <span aria-hidden="true" className="mx-4 text-gray-400 shrink-0">/</span>
              <span className="truncate min-w-0 max-w-[80ch]">{tailText}</span>
            </li>
          )}
        </ol>
      </div>
    </nav>
  );
}
