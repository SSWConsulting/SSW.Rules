'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RiGithubLine, RiPencilLine } from 'react-icons/ri';
import { IconLink } from '@/components/ui';
import Bookmark from '../Bookmark';
import { ICON_SIZE } from '@/constants';
import { useUser } from '@auth0/nextjs-auth0';

export interface RuleListItemHeaderProps {
    rule: {
        guid: string;
        title: string;
        uri: string;
        isBookmarked: boolean;
    };
    showBookmark?: boolean;
    onBookmarkRemoved?: (ruleGuid: string) => void;
    index: number;
}

const RuleListItemHeader: React.FC<RuleListItemHeaderProps> = ({ rule, showBookmark = false, onBookmarkRemoved, index }) => {
    const linkRef = useRef<HTMLAnchorElement>(null);
    const [isBookmarked, setIsBookmarked] = useState<boolean>(rule.isBookmarked);
     const { user } = useUser();
    const [isRemoving, setIsRemoving] = useState(false);

    useEffect(() => {
        setIsBookmarked(rule.isBookmarked);
    }, [rule.isBookmarked]);

    const handleBookmarkToggle = async (newStatus: boolean) => {
        setIsBookmarked(newStatus);
    };

      const handleRemoveBookmark = async (ruleGuid: string) => {
    if (!user?.sub) return;
    
    setIsRemoving(true);
    try {
      if (onBookmarkRemoved) {
        onBookmarkRemoved(ruleGuid);
      }
    } catch (error) {
      console.error('Error removing bookmark:', error);
    } finally {
      setIsRemoving(false);
    }
  };

    return (
        <section className='mb-2'>
            <div className='flex items-center flex-col justify-between sm:flex-row'>
                <div className='flex items-center gap-4 md:gap-2'>
                    <span className='text-sm text-gray-500'>#{index + 1}</span>
                    <h2 className='m-0 text-2xl'>
                        <Link href={`../${rule.uri}`} ref={linkRef} className='no-underline'>
                            {rule.title}
                        </Link>
                    </h2>
                </div>

                {showBookmark && (
                    <div className='profile-rule-buttons flex gap-3 justify-center mt-4 md:mt-0'>
                        <Bookmark ruleGuid={rule.guid} isBookmarked={isBookmarked} onBookmarkToggle={handleBookmarkToggle} />
                        <IconLink href={`./admin#/~/${rule?.uri}`} children={<RiPencilLine size={ICON_SIZE} />} />
                        <IconLink
                            href={`https://github.com/SSWConsulting/SSW.Rules.Content/blob/main/rules/${rule?.uri}/rule.md`}
                            target='_blank'
                            children={<RiGithubLine size={ICON_SIZE} className='rule-icon' />}
                        />
                    </div>
                )}
            </div>
        </section>
    );
};

export default RuleListItemHeader;
