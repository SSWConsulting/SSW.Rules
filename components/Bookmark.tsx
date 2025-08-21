'use client';

import { useUser, getAccessToken } from '@auth0/nextjs-auth0';
import { useRouter } from 'next/navigation';
import { BookmarkService } from '@/lib/bookmarkService';
import { RiBookmarkLine, RiBookmarkFill } from 'react-icons/ri';

interface BookmarkProps {
  ruleId: string;
  isBookmarked: boolean;
  onBookmarkToggle: (ruleId: string, newStatus: boolean) => void;
  size?: number;
  className?: string;
}

export default function Bookmark({ ruleId, isBookmarked, onBookmarkToggle, size = 32, className = '' }: BookmarkProps) {
  const { user, isLoading: authLoading } = useUser();
  const router = useRouter();

  const handleBookmarkToggle = async () => {
    if (!user) {
      const currentPath = window.location.pathname;
      router.push(`/auth/login?returnTo=${encodeURIComponent(currentPath)}`);
      return;
    }

    try {
      const accessToken = await getAccessToken();
      
      if (!accessToken) {
        console.error('No access token available');
        return;
      }

      const data = { ruleGuid: ruleId, UserId: user.sub };
      
      if (isBookmarked) {
        const result = await BookmarkService.removeBookmark(data, accessToken);
        if (!result.error) {
          onBookmarkToggle(ruleId, false);
        } else {
          console.error('Failed to remove bookmark:', result.message);
        }
      } else {
        const result = await BookmarkService.addBookmark(data, accessToken);
        if (!result.error) {
          onBookmarkToggle(ruleId, true);
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
      title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
      {isBookmarked ? (
        <RiBookmarkFill size={size} className="text-ssw-red" />
      ) : (
        <RiBookmarkLine size={size} />
      )}
    </button>
  );
}
