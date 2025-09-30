'use client';

import React, { useEffect, useState } from "react";
import Link from "next/link";
import RuleList from "@/components/rule-list";
import { getAccessToken } from "@auth0/nextjs-auth0";
import { BookmarkService } from "@/lib/bookmarkService";
import { useAuth } from "@/components/auth/UserClientProvider";
import { Rule } from "@/models/Rule";
import { PiWarningFill } from "react-icons/pi";

export default function OrphanedClientPage(props) {
  const { orphanedRules } = props;

  const { user, isLoading: authLoading } = useAuth();
  const [annotatedRules, setAnnotatedRules] = useState<any[]>([]);
  const [rightSidebarRules, setRightSidebarRules] = useState<any[]>([]);
  const [bookmarkedGuids, setBookmarkedGuids] = useState<string[]>([]);

  // Fetch user bookmarks as soon as auth is ready
  useEffect(() => {
    let cancelled = false;
    async function fetchBookmarks() {
      if (authLoading) return;
      if (!user?.sub) {
        setBookmarkedGuids([]);
        return;
      }
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          setBookmarkedGuids([]);
          return;
        }
        const bookmarkResult: any = await BookmarkService.getUserBookmarks(user.sub, accessToken);
        const guids: string[] = (bookmarkResult?.bookmarkedRules || []).map((b: any) => b?.ruleGuid).filter((g: any): g is string => Boolean(g));
        if (!cancelled) setBookmarkedGuids(guids);
      } catch {
        if (!cancelled) setBookmarkedGuids([]);
      }
    }
    fetchBookmarks();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.sub]);

  // Derive annotated rules when baseRules or bookmarks change
  useEffect(() => {
    if (!orphanedRules || orphanedRules.length === 0) {
      setAnnotatedRules([]);
      setRightSidebarRules([]);
      return;
    }
    const bookmarkSet = new Set(bookmarkedGuids);
    
    const updated = orphanedRules.map((r: any) => ({
      ...r,
      isBookmarked: r?.guid ? bookmarkSet.has(r.guid) : false,
    }));
    setAnnotatedRules(updated);
    setRightSidebarRules(updated);
  }, [orphanedRules, bookmarkedGuids]);

  return (
    <div>
      <div className="flex">
        <div className="w-full lg:w-2/3 bg-white pt-4 p-6 rounded shadow">
          <h1 className="m-0 mb-2 text-ssw-red font-bold">Orphaned Rules</h1>
          
          {/* Warning alert card */}
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center">
            <PiWarningFill className="inline text-ssw-red mr-2" size={18} />
            <span className="text-red-800">The rules listed below have no parent category</span>
          </div>

          <RuleList 
            rules={annotatedRules} 
            type="orphaned" 
            noContentMessage="No orphaned rules found."
          />
        </div>
        <div className="hidden lg:w-1/3 lg:block md:hidden p-6 pr-0">
          <ol className="border-l-3 border-gray-300 pl-6">
            {rightSidebarRules.map((rule, index) => (
              <li key={`sidebar-${rule.guid}-${index}`} className="py-1 ml-4">
                <Link href={rule.uri} className="text-gray-700 hover:text-ssw-red">
                  {rule.title}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}