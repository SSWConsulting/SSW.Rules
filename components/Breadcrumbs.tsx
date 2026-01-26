import Link from "next/link";
import React from "react";
import { withBasePath } from "@/lib/withBasePath";
import { parentSiteUrl, siteUrlRelative } from "@/site-config";

interface BreadcrumbProps {
  categories?: { link: string; title: string }[];
  isCategory?: boolean;
  isHomePage?: boolean;
  breadcrumbText?: string;
  iconSrc?: string;
}

const ChevronIcon: React.FC<{ className?: string; size?: number }> = ({ className = "", size = 18 }) => (
  <svg
    aria-hidden
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={`block flex-none ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export default function Breadcrumbs({ categories, isCategory = false, isHomePage = false, breadcrumbText, iconSrc = "/uploads/icon.png" }: BreadcrumbProps) {
  const showCategories = typeof categories !== "undefined";
  const categoryList = showCategories && (categories?.length ?? 0) > 0 ? categories! : showCategories ? [{ link: "/orphaned", title: "Orphaned" }] : [];

  const tailText = breadcrumbText ?? (isCategory ? "This category" : "This rule");

  return (
    <nav aria-label="Breadcrumb" className="m-4 mt-2">
      <div className="grid grid-cols-[auto_1fr] gap-2 items-start md:items-center">
        <a href={parentSiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center shrink-0 translate-y-[2px] md:translate-y-0 md:h-[1.5em]">
          <img alt="SSW Foursquare" src={withBasePath(iconSrc)} width={16} height={16} className="block w-4 h-4" loading="lazy" decoding="async" />
          <ChevronIcon className="ml-2 hidden md:block" size={18} />
        </a>

        <ol className="flex min-w-0 list-none p-0 m-0 flex-col items-start md:flex-row md:items-center">
          <li className="flex items-center mb-0 md:h-[1.5em]">
            <ChevronIcon className="mr-2 block md:hidden" size={18} />
            <Link
              href={siteUrlRelative}
              className="transition underline decoration-1 decoration-gray-400 underline-offset-2 duration-150 hover:text-ssw-red hover:decoration-ssw-red"
            >
              SSW Rules
            </Link>
          </li>

          {showCategories &&
            categoryList.map((cat, i) => (
              <li key={i} className="mt-1 flex items-center mb-0 md:mt-0">
                <ChevronIcon className="mr-2 md:mx-2 block" size={18} />
                <Link
                  href={cat.link}
                  className="transition underline decoration-1 decoration-gray-400 underline-offset-2 duration-150 hover:text-ssw-red hover:decoration-ssw-red"
                >
                  {cat.title.replace(/Rules to(?: Better)?/i, "").trim()}
                </Link>
              </li>
            ))}

          {!isHomePage && (
            <li className="mt-1 flex items-center mb-0 md:mt-0" aria-current="page">
              <ChevronIcon className="mr-2 md:mx-2 block" size={18} />
              <span className="truncate">{tailText}</span>
            </li>
          )}
        </ol>
      </div>
    </nav>
  );
}
