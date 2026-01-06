"use client";

import React, { useMemo, useRef, useState } from "react";
import { CgSortAz } from "react-icons/cg";
import { RiGithubLine, RiPencilLine } from "react-icons/ri";
import RadioButton from "@/components/radio-button";
import Dropdown from "@/components/ui/dropdown";
import Pagination from "@/components/ui/pagination";
import { ICON_SIZE } from "@/constants";
import { RuleListFilter } from "@/types/ruleListFilter";
import { IconLink } from "../ui";
import RuleListItem from "./rule-list-item";

export interface SortOption {
  value: string;
  label: string;
  rules: any[];
}

export interface RuleListProps {
  categoryUri?: string;
  rules: any[];
  type?: string;
  noContentMessage?: string;
  onBookmarkRemoved?: (ruleGuid: string) => void;
  showPagination?: boolean;
  showTitlesView?: boolean;
  showBlurbsView?: boolean;
  showEverythingView?: boolean;
  initialView?: RuleListFilter;
  initialPage?: number;
  initialPerPage?: number;
  sortOptions?: SortOption[];
  initialSort?: string;
  onSortChange?: (sort: string) => void;
}

const RuleList: React.FC<RuleListProps> = ({
  categoryUri,
  rules,
  type,
  noContentMessage,
  onBookmarkRemoved,
  showPagination = true,
  showTitlesView = true,
  showBlurbsView = true,
  showEverythingView = true,
  initialView = RuleListFilter.Blurb,
  initialPage = 1,
  initialPerPage = 20,
  sortOptions,
  initialSort,
  onSortChange,
}) => {
  const [filter, setFilter] = useState<RuleListFilter>(initialView);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPage] = useState(initialPerPage);
  const [currentSort, setCurrentSort] = useState(initialSort ?? sortOptions?.[0]?.value ?? "");
  const filterSectionRef = useRef<HTMLDivElement>(null);
  const showFilterControls = showTitlesView || showBlurbsView || showEverythingView;

  // Get the current rules based on sort selection
  const activeRules = useMemo(() => {
    if (sortOptions && sortOptions.length > 0) {
      const selectedOption = sortOptions.find((opt) => opt.value === currentSort);
      return selectedOption?.rules ?? rules;
    }
    return rules;
  }, [sortOptions, currentSort, rules]);

  const displayItemsPerPage = useMemo(() => (showPagination ? itemsPerPage : activeRules.length), [showPagination, itemsPerPage, activeRules.length]);

  const totalPages = displayItemsPerPage >= activeRules.length ? 1 : Math.ceil(activeRules.length / displayItemsPerPage);

  const paginatedRules = useMemo(() => {
    if (displayItemsPerPage >= activeRules.length) {
      return activeRules; // Show all rules
    }
    const startIndex = (currentPage - 1) * displayItemsPerPage;
    const endIndex = startIndex + displayItemsPerPage;
    return activeRules.slice(startIndex, endIndex);
  }, [activeRules, currentPage, displayItemsPerPage]);

  const handleSortChange = (value: string) => {
    setCurrentSort(value);
    setCurrentPage(1); // Reset to first page when changing sort
    onSortChange?.(value);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to just above the filter options when page changes
    setTimeout(() => {
      if (filterSectionRef.current) {
        const rect = filterSectionRef.current.getBoundingClientRect();
        const offsetTop = window.pageYOffset + rect.top - 5; // 5px above the filter section
        window.scrollTo({ top: offsetTop, behavior: "smooth" });
      }
    }, 50); // Small delay to ensure DOM is updated
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleOptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value as RuleListFilter);
  };

  if (activeRules.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-xl text-gray-600">{noContentMessage || "No rules found."}</p>
      </div>
    );
  }

  return (
    <>
      <div ref={filterSectionRef} className="flex flex-col-reverse justify-between items-center mt-2 sm:flex-row sm:mt-0">
        {showFilterControls && (
          <div className="flex items-center py-4">
            <span className="mr-4 hidden sm:block">Show me</span>
            {showTitlesView && (
              <RadioButton
                id="customRadioInline1"
                value="titleOnly"
                selectedOption={filter}
                handleOptionChange={handleOptionChange}
                labelText="Titles"
                className="rounded-l-md"
              />
            )}
            {showBlurbsView && (
              <RadioButton
                id="customRadioInline3"
                value="blurb"
                selectedOption={filter}
                handleOptionChange={handleOptionChange}
                labelText="Blurbs"
                className={!showEverythingView ? "rounded-r-md" : ""}
              />
            )}
            {showEverythingView && (
              <RadioButton
                id="customRadioInline2"
                value="all"
                selectedOption={filter}
                handleOptionChange={handleOptionChange}
                labelText="Everything"
                className={showEverythingView ? "rounded-r-md" : ""}
              />
            )}
          </div>
        )}

        {sortOptions && sortOptions.length > 1 && (
          <div className="flex items-center gap-1 sm:ml-4">
            <CgSortAz className="text-gray-500" size={24} />
            <Dropdown options={sortOptions.map((opt) => ({ value: opt.value, label: opt.label }))} value={currentSort} onChange={handleSortChange} />
          </div>
        )}
      </div>
      {type === "category" && (
        <div className="hidden md:flex gap-2">
          <IconLink
            href={`admin/index.html#/collections/edit/category/${categoryUri?.slice(0, -4)}`}
            title="Edit category"
            tooltipOpaque={true}
            children={<RiPencilLine size={ICON_SIZE} />}
          />
          <IconLink
            href={`https://github.com/SSWConsulting/SSW.Rules.Content/blob/${process.env.NEXT_PUBLIC_TINA_BRANCH}/categories/${categoryUri}`}
            target="_blank"
            title="View category on GitHub"
            tooltipOpaque={true}
            children={<RiGithubLine size={ICON_SIZE} className="rule-icon" />}
          />
        </div>
      )}

      <ol className="flex flex-col justify-between gap-2 p-0 list-none">
        {paginatedRules.map((rule, i) => (
          <RuleListItem
            key={`${rule.guid}-${rule.uri}-${(currentPage - 1) * itemsPerPage + i}`}
            rule={rule}
            index={(currentPage - 1) * itemsPerPage + i}
            onBookmarkRemoved={onBookmarkRemoved}
            filter={filter}
            currentSort={currentSort}
          />
        ))}
      </ol>

      {showPagination && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={activeRules.length}
          itemsPerPage={displayItemsPerPage}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      )}
    </>
  );
};

export default RuleList;
