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
}

const RuleList: React.FC<RuleListProps> = ({ categoryUri, rules, type, noContentMessage, onBookmarkRemoved }) => {
  const [filter, setFilter] = useState<RuleListFilter>(RuleListFilter.Blurb);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const filterSectionRef = useRef<HTMLDivElement>(null);

  const paginatedRules = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return rules.slice(startIndex, endIndex);
  }, [rules, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(rules.length / itemsPerPage);

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
        <div className="flex gap-2 items-center py-4 text-center lg:grid-cols-5">
          <RadioButton
            id="customRadioInline1"
            value="titleOnly"
            selectedOption={filter}
            handleOptionChange={handleOptionChange}
            labelText="View Titles Only"
          />
          <RadioButton id="customRadioInline2" value="all" selectedOption={filter} handleOptionChange={handleOptionChange} labelText="Gimme Everything" />
          <RadioButton id="customRadioInline3" value="blurb" selectedOption={filter} handleOptionChange={handleOptionChange} labelText="Show Blurb" />
          <p className="mx-3 hidden sm:block">{rules.length} Rules</p>
        </div>
        {type === 'category' && (
          <div className="flex gap-2">
            <IconLink
              href={`admin/index.html#/collections/edit/category/${categoryUri?.slice(0, -4)}`}
              children={<RiPencilLine size={ICON_SIZE} />}
            />
            <IconLink
              href={`https://github.com/SSWConsulting/SSW.Rules.Content/blob/${process.env.NEXT_PUBLIC_TINA_BRANCH}/categories/${categoryUri}`}
              target="_blank"
              children={<RiGithubLine size={ICON_SIZE} className="rule-icon" />}
            />
          </div>
        )}
      </div>

      <ol className="flex flex-col justify-between gap-4 p-0 list-none">
        {paginatedRules.map((rule, i) => (
          <RuleListItem 
            key={`${rule.guid}-${rule.uri}`} 
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
