'use client';

import { useState, useEffect } from 'react';
import {  getAccessToken } from '@auth0/nextjs-auth0';
import { useRouter } from 'next/navigation';
import { BookmarkService } from '@/lib/bookmarkService';
import { RiBookmarkLine, RiBookmarkFill } from 'react-icons/ri';
import { ICON_SIZE } from '@/constants';
import { useAuth } from './auth/UserClientProvider';

interface BookmarkProps {
  ruleGuid: string;
  isBookmarked: boolean;
  onBookmarkToggle: (newStatus: boolean) => void;
  className?: string;
}

export default function Bookmark({ ruleGuid, isBookmarked, onBookmarkToggle, className = '' }: BookmarkProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState<boolean>(isBookmarked);

  useEffect(() => {
    setBookmarked(isBookmarked);
  }, [isBookmarked]);

  const handleBookmarkToggle = async () => {
    const currentPath = window.location.pathname;
    const userId = user?.sub;
    if (!userId) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(currentPath)}`);
      return;
    }

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        console.error('No access token available');
        return;
      }

      const data = { ruleGuid: ruleGuid, UserId: userId };

      if (bookmarked) {
        const result = await BookmarkService.removeBookmark(data, accessToken);
        if (!result.error) {
          setBookmarked(false);
          onBookmarkToggle(false);
        } else {
          console.error('Failed to remove bookmark:', result.message);
        }
      } else {
        const result = await BookmarkService.addBookmark(data, accessToken);
        if (!result.error) {
          setBookmarked(true);
          onBookmarkToggle(true);
        } else {
          console.error('Failed to add bookmark:', result.message);
        }
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  return (
    <button
      onClick={handleBookmarkToggle}
      className={`rule-icon ${className}`}
      title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
      {bookmarked ? (
        <RiBookmarkFill size={ICON_SIZE} className="text-ssw-red" />
      ) : (
        <RiBookmarkLine size={ICON_SIZE} />
      )}
    </button>
  );
}
