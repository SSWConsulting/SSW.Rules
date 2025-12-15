"use client";

import { getAccessToken } from "@auth0/nextjs-auth0";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RiBookmarkFill, RiBookmarkLine } from "react-icons/ri";
import { ICON_SIZE } from "@/constants";
import { BookmarkService } from "@/lib/bookmarkService";
import { BookmarkData } from "@/types";
import { useAuth } from "./auth/UserClientProvider";
import Popup from "./Popup";
import Spinner from "./Spinner";
import Tooltip from "./tooltip/tooltip";

interface BookmarkProps {
  ruleGuid: string;
  isBookmarked?: boolean;
  defaultIsBookmarked?: boolean;
  onBookmarkToggle?: (newStatus: boolean) => void;
  className?: string;
}

export default function Bookmark({ ruleGuid, isBookmarked, defaultIsBookmarked = false, onBookmarkToggle, className = "" }: BookmarkProps) {
  const controlled = useMemo(() => typeof isBookmarked === "boolean", [isBookmarked]);

  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const query = useSearchParams()?.toString();

  const [bookmarked, setBookmarked] = useState<boolean>(controlled ? (isBookmarked as boolean) : defaultIsBookmarked);
  const [initialLoading, setInitialLoading] = useState<boolean>(!controlled);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  useEffect(() => {
    if (controlled) setBookmarked(isBookmarked as boolean);
  }, [controlled, isBookmarked]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (controlled) return;
      try {
        if (!user?.sub || !ruleGuid) {
          setInitialLoading(false);
          return;
        }
        const accessToken = await getAccessToken();
        if (!accessToken) {
          setInitialLoading(false);
          return;
        }
        const result = await BookmarkService.getBookmarkStatus(ruleGuid, user.sub, accessToken);
        if (!cancelled && !result.error) {
          setBookmarked(Boolean(result.bookmarkStatus));
        }
      } catch (e) {
        console.error("Failed to fetch bookmark status", e);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [controlled, ruleGuid, user?.sub]);

  const handleBookmarkToggle = async () => {
    const userId = user?.sub;

    if (!userId) {
      setShowLoginModal(true);
      return;
    }

    setIsLoading(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        console.error("No access token available");
        return;
      }

      const data: BookmarkData = { ruleGuid, userId };

      if (bookmarked) {
        const result = await BookmarkService.removeBookmark(data, accessToken);
        if (!result.error) {
          if (!controlled) setBookmarked(false);
          onBookmarkToggle?.(false);
        } else {
          console.error("Failed to remove bookmark:", result.message);
        }
      } else {
        const result = await BookmarkService.addBookmark(data, accessToken);
        if (!result.error) {
          if (!controlled) setBookmarked(true);
          onBookmarkToggle?.(true);
        } else {
          console.error("Failed to add bookmark:", result.message);
        }
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    const current = query ? `${pathname}?${query}` : pathname;
    setIsRedirecting(true);
    router.push(`/auth/login?returnTo=${encodeURIComponent(current)}`);
  };

  const disabled = isLoading || initialLoading;

  return (
    <>
      <Tooltip text={bookmarked ? "Remove bookmark" : "Add bookmark"} showDelay={0} hideDelay={0} opaque={true}>
        <button
          onClick={handleBookmarkToggle}
          className={`rule-icon ${className}`}
          title={bookmarked ? "Remove bookmark" : "Add bookmark"}
          disabled={disabled}
          aria-busy={disabled}
          aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
        >
          {disabled ? (
            <Spinner size="sm" inline />
          ) : bookmarked ? (
            <RiBookmarkFill size={ICON_SIZE} className="text-ssw-red" aria-hidden="true" />
          ) : (
            <RiBookmarkLine size={ICON_SIZE} className="hover:text-ssw-red transition-colors duration-200" aria-hidden="true" />
          )}
        </button>
      </Tooltip>

      <Popup
        showCloseIcon
        isVisible={showLoginModal}
        className="min-w-sm max-w-lg"
        onClose={() => {
          setIsRedirecting(false);
          setShowLoginModal(false);
        }}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2">Sign in required</h3>
          <p className="text-gray-700">Sign in to bookmark this rule.</p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => {
                setIsRedirecting(false);
                setShowLoginModal(false);
              }}
              className="px-4 py-2 rounded border border-gray-300 cursor-pointer hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleLoginRedirect}
              disabled={isRedirecting}
              aria-busy={isRedirecting}
              className="px-4 py-2 rounded bg-ssw-red text-white cursor-pointer hover:bg-ssw-red/90"
            >
              {isRedirecting ? (
                <span className="flex items-center gap-2">
                  <span>Signing in...</span>
                  <Spinner size="sm" inline className="text-white" />
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </div>
        </div>
      </Popup>
    </>
  );
}
