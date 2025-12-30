"use client";
import React, { useState, useEffect } from 'react';
import RuleList from './rule-list';
import { RuleListFilter } from '@/types/ruleListFilter';

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
  initialView?: 'titleOnly' | 'blurb' | 'all';
  initialPage?: number;
  initialPerPage?: number;
}

const RuleListWrapper: React.FC<RuleListWrapperProps> = ({
  initialView = 'blurb',
  initialPage = 1,
  initialPerPage = 20,
  ...props 
}) => {
  const [filter, setFilter] = useState<RuleListFilter>(() => {
    // Map the view prop to RuleListFilter enum
    switch (initialView) {
      case 'titleOnly':
        return RuleListFilter.TitleOnly;
      case 'blurb':
        return RuleListFilter.Blurb;
      case 'all':
        return RuleListFilter.All;
      default:
        return RuleListFilter.Blurb;
    }
  });

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPage] = useState(initialPerPage);

  // Update state when props change (for URL navigation)
  useEffect(() => {
    switch (initialView) {
      case 'titleOnly':
        setFilter(RuleListFilter.TitleOnly);
        break;
      case 'blurb':
        setFilter(RuleListFilter.Blurb);
        break;
      case 'all':
        setFilter(RuleListFilter.All);
        break;
    }
  }, [initialView]);

  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    setItemsPerPage(initialPerPage);
  }, [initialPerPage]);

  return (
    <RuleList
      {...props}
      initialFilter={filter}
      initialPage={currentPage}
      initialItemsPerPage={itemsPerPage}
    />
  );
};

export default RuleListWrapper;
