'use client';

import React, { useState } from 'react';
import RuleListItem from './rule-list-item';
import RadioButton from '@/components/radio-button';
import { RiPencilLine, RiGithubLine } from 'react-icons/ri';
import { RuleListFilter } from '@/types/ruleListFilter';
import { IconLink } from '../ui';
import { ICON_SIZE } from '@/constants';

export interface RuleListProps {
  categoryUri?: string;
  rules: any[];
  type?: string;
  noContentMessage?: string;
  onBookmarkRemoved?: (ruleGuid: string) => void;
}

const RuleList: React.FC<RuleListProps> = ({ categoryUri, rules, type, noContentMessage, onBookmarkRemoved }) => {
  const [filter, setFilter] = useState<RuleListFilter>(RuleListFilter.Blurb);

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
      <div className="flex flex-col-reverse justify-between items-center mt-2 sm:flex-row sm:mt-0">
        <div className="flex gap-2 items-center py-4 text-center lg:grid-cols-5">
          <RadioButton
            id="customRadioInline1"
            value="titleOnly"
            selectedOption={filter}
            handleOptionChange={handleOptionChange}
            labelText="Title"
          />
          <RadioButton id="customRadioInline3" value="blurb" selectedOption={filter} handleOptionChange={handleOptionChange} labelText="Blurbs" />
          <RadioButton id="customRadioInline2" value="all" selectedOption={filter} handleOptionChange={handleOptionChange} labelText="Everythings" />
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
        {rules.map((rule, i) => (
          <RuleListItem key={`${rule.guid}-${rule.uri}`} rule={rule} index={i} onBookmarkRemoved={onBookmarkRemoved} filter={filter} />
        ))}
      </ol>
    </>
  );
};

export default RuleList;
