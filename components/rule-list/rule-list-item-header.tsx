'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { RiBookmarkFill } from 'react-icons/ri';
import { useUser } from '@auth0/nextjs-auth0';
import { IconButton } from '@/components/ui';

export interface RuleListItemHeaderProps {
  rule: {
    guid: string;
    title: string;
    uri: string;
  };
  showBookmark?: boolean;
  onBookmarkRemoved?: (ruleGuid: string) => void;
}

const RuleListItemHeader: React.FC<RuleListItemHeaderProps> = ({ 
  rule, 
  showBookmark = false, 
  onBookmarkRemoved }) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const { user } = useUser();
  const [isRemoving, setIsRemoving] = useState(false);

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
    <section className="bg-[#f5f5f5] p-5 border-l-2 border-l-red-700">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-2xl">
          <Link href={`../${rule.uri}`} ref={linkRef} className="no-underline">
            {rule.title}
          </Link>
        </h2>

        {showBookmark && (
          <div className="profile-rule-buttons flex flex-col justify-center">
            <IconButton
              onClick={() => handleRemoveBookmark(rule.guid)}
              disabled={isRemoving}
              className={isRemoving ? 'opacity-50' : ''}
            >
              <RiBookmarkFill size={26} className="text-ssw-red" />
            </IconButton>
          </div>
        )}
      </div>
    </section>
  );
};

export default RuleListItemHeader;
