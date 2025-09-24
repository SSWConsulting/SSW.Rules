'use client';

import React, { useState, useMemo, useRef } from 'react';
import RuleListItem from './rule-list-item';
import RadioButton from '@/components/radio-button';
import { RiPencilLine, RiGithubLine } from 'react-icons/ri';
import { RuleListFilter } from '@/types/ruleListFilter';
import { IconLink } from '../ui';
import { ICON_SIZE } from '@/constants';
import Pagination from '@/components/ui/pagination';

export interface RuleListProps {
  categoryUri?: string;
  rules: any[];
  type?: string;
  noContentMessage?: string;
  onBookmarkRemoved?: (ruleGuid: string) => void;
  includeArchived?: boolean;
  onIncludeArchivedChange?: (include: boolean) => void;
}

const RuleList: React.FC<RuleListProps> = ({ categoryUri, rules, type, noContentMessage, onBookmarkRemoved, includeArchived = false, onIncludeArchivedChange }) => {
  const [filter, setFilter] = useState<RuleListFilter>(RuleListFilter.Blurb);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const filterSectionRef = useRef<HTMLDivElement>(null);

  const paginatedRules = useMemo(() => {
    if (itemsPerPage >= rules.length) {
      return rules; // Show all rules
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return rules.slice(startIndex, endIndex);
  }, [rules, currentPage, itemsPerPage]);

  const totalPages = itemsPerPage >= rules.length ? 1 : Math.ceil(rules.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to just above the filter options when page changes
    setTimeout(() => {
      if (filterSectionRef.current) {
        const rect = filterSectionRef.current.getBoundingClientRect();
        const offsetTop = window.pageYOffset + rect.top - 5; // 5px above the filter section
        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
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

  const handleIncludeArchivedChange = (include: boolean) => {
    setCurrentPage(1); // Reset to first page when toggling archived
    if (onIncludeArchivedChange) {
      onIncludeArchivedChange(include);
    }
  };

  if (rules.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-xl text-gray-600">{noContentMessage || 'No rules found.'}</p>
      </div>
    );
  }

  return (
    <>
      <div ref={filterSectionRef} className="flex flex-col-reverse justify-between items-center mt-2 sm:flex-row sm:mt-0">
        <div className="flex flex-col items-center sm:flex-row sm:items-center gap-2 py-4 text-center lg:grid-cols-5">
          <div className="flex items-center">
            <RadioButton
              id="customRadioInline1"
              value="titleOnly"
              selectedOption={filter}
              handleOptionChange={handleOptionChange}
              labelText="Titles"
              position='first'
            />
            <RadioButton id="customRadioInline3" value="blurb" selectedOption={filter} handleOptionChange={handleOptionChange} labelText="Blurbs" position='middle'/>
            <RadioButton id="customRadioInline2" value="all" selectedOption={filter} handleOptionChange={handleOptionChange} labelText="Everything" position='last'/>
          </div>
          {onIncludeArchivedChange && (
            <label className="flex items-center gap-2 px-4 py-1 text-sm cursor-pointer hover:bg-gray-50 transition-colors bg-white sm:ml-2">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => handleIncludeArchivedChange(e.target.checked)}
                className="w-4 h-4 border-gray-300 rounded focus:ring-ssw-red focus:ring-2 accent-ssw-red"
              />
              <span className="text-gray-700">Include Archived</span>
            </label>
          )}
          <p className="mx-3 hidden sm:block">{rules.length} Rules</p>
        </div>
        {type === 'category' && (
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
      </div>

      <ol className="flex flex-col justify-between gap-4 p-0 list-none">
        {paginatedRules.map((rule, i) => (
          <RuleListItem 
            key={`${rule.guid}-${rule.uri}-${(currentPage - 1) * itemsPerPage + i}`} 
            rule={rule} 
            index={(currentPage - 1) * itemsPerPage + i} 
            onBookmarkRemoved={onBookmarkRemoved} 
            filter={filter} 
          />
        ))}
      </ol>
      
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={rules.length}
        itemsPerPage={itemsPerPage}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
      />
    </>
  );
};

export default RuleList;
