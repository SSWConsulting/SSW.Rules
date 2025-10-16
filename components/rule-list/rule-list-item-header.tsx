'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RiGithubLine, RiPencilLine } from 'react-icons/ri';
import { IconLink } from '@/components/ui';
import Bookmark from '../Bookmark';
import { ICON_SIZE } from '@/constants';

export interface RuleListItemHeaderProps {
  rule: {
    guid: string;
    title: string;
    uri: string;
    isBookmarked: boolean;
    isArchived?: boolean;
  };
  showBookmark?: boolean;
  onBookmarkRemoved?: (ruleGuid: string) => void;
  index: number;
}

const RuleListItemHeader: React.FC<RuleListItemHeaderProps> = ({ rule, showBookmark = false, onBookmarkRemoved, index }) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(rule.isBookmarked);

  useEffect(() => {
    setIsBookmarked(rule.isBookmarked);
  }, [rule.isBookmarked]);

  const handleBookmarkToggle = async (newStatus: boolean) => {
    setIsBookmarked(newStatus);
  };

  // Remove any extra slashes from the base path
  const sanitizedBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/^\/+/, '');

  return (
    <section className='my-1.5'>
      <div className="flex items-center flex-col justify-between sm:flex-row">
        <div className="flex flex-col gap-2">
          <div className="flex">
            <span className="text-sm text-gray-500 w-6 flex-shrink-0 mt-1">#{index + 1}</span>
            <h2 className="m-0 text-2xl">
              <Link href={`/${rule.uri}`} ref={linkRef} className="no-underline">
                {rule.title}
              </Link>
            </h2>
          </div>
          {rule.isArchived && (
            <div className="ml-8 md:ml-6">
              <span className="inline-block bg-red-600 text-white text-sm px-2 py-1 rounded font-medium">
                Archived
              </span>
            </div>
          )}
        </div>

        {showBookmark && (
          <div className="profile-rule-buttons flex gap-3 justify-center self-start mt-4 md:mt-0">
            <Bookmark ruleGuid={rule.guid} isBookmarked={isBookmarked} onBookmarkToggle={handleBookmarkToggle} />
            <IconLink
              href={`/admin#/~/${sanitizedBasePath}/${rule?.uri}`}
              title="Edit rule"
              tooltipOpaque={true}
              children={<RiPencilLine size={ICON_SIZE} />}
            />
            <IconLink
              href={`https://github.com/SSWConsulting/SSW.Rules.Content/blob/main/rules/${rule?.uri}/rule.md`}
              target="_blank"
              title="View rule on GitHub"
              tooltipOpaque={true}
              children={<RiGithubLine size={ICON_SIZE} className="rule-icon" />}
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default RuleListItemHeader;
