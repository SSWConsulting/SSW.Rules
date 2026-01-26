"use client";
import React, { useEffect, useMemo, useState } from "react";
import { RuleListFilter } from "@/types/ruleListFilter";
import RuleList from "./rule-list";

export interface RuleListWrapperProps {
  categoryUri?: string;
  rules: any[];
  type?: string;
  noContentMessage?: string;
  onBookmarkRemoved?: (ruleGuid: string) => void;

  includeArchived?: boolean;
  onIncludeArchivedChange?: (include: boolean) => void;

  showPagination?: boolean;
  showFilterControls?: boolean;
  initialView?: "titleOnly" | "blurb" | "all";
  initialPage?: number;
  initialPerPage?: number;
}

const isArchivedRule = (r: any) => r?.isArchived === true || r?.isArchived === "true" || r?.isArchived === 1;

const RuleListWrapper: React.FC<RuleListWrapperProps> = ({
  rules,
  includeArchived: includeArchivedProp,
  onIncludeArchivedChange: onIncludeArchivedChangeProp,
  initialView = "blurb",
  initialPage = 1,
  initialPerPage = 20,
  ...rest
}) => {
  const [filter, setFilter] = useState<RuleListFilter>(() => {
    switch (initialView) {
      case "titleOnly":
        return RuleListFilter.TitleOnly;
      case "blurb":
        return RuleListFilter.Blurb;
      case "all":
        return RuleListFilter.All;
      default:
        return RuleListFilter.Blurb;
    }
  });

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPage] = useState(initialPerPage);

  const externallyControlled = typeof onIncludeArchivedChangeProp === "function";
  const [includeArchivedState, setIncludeArchivedState] = useState<boolean>(includeArchivedProp ?? false);

  useEffect(() => {
    if (externallyControlled) {
      setIncludeArchivedState(includeArchivedProp ?? false);
    }
  }, [externallyControlled, includeArchivedProp]);

  useEffect(() => {
    switch (initialView) {
      case "titleOnly":
        setFilter(RuleListFilter.TitleOnly);
        break;
      case "blurb":
        setFilter(RuleListFilter.Blurb);
        break;
      case "all":
        setFilter(RuleListFilter.All);
        break;
    }
  }, [initialView]);

  useEffect(() => setCurrentPage(initialPage), [initialPage]);
  useEffect(() => setItemsPerPage(initialPerPage), [initialPerPage]);

  const { activeRules, archivedRules } = useMemo(() => {
    const active: any[] = [];
    const archived: any[] = [];
    for (const r of rules ?? []) (isArchivedRule(r) ? archived : active).push(r);
    return { activeRules: active, archivedRules: archived };
  }, [rules]);

  const effectiveIncludeArchived = externallyControlled ? (includeArchivedProp ?? false) : includeArchivedState;

  const displayRules = useMemo(
    () => (effectiveIncludeArchived ? [...activeRules, ...archivedRules] : activeRules),
    [effectiveIncludeArchived, activeRules, archivedRules]
  );

  const handleIncludeArchivedChange = (include: boolean) => {
    if (externallyControlled && onIncludeArchivedChangeProp) {
      onIncludeArchivedChangeProp(include);
      return;
    }
    setIncludeArchivedState(include);
  };

  return (
    <RuleList
      {...rest}
      rules={displayRules}
      includeArchived={effectiveIncludeArchived}
      onIncludeArchivedChange={handleIncludeArchivedChange}
      initialFilter={filter}
      initialPage={currentPage}
      initialItemsPerPage={itemsPerPage}
    />
  );
};

export default RuleListWrapper;
