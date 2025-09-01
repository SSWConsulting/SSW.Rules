"use client";

import React, { useEffect, useMemo, useState } from "react";
import { tinaField, useTina } from "tinacms/dist/react";
import Link from "next/link";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import MarkdownComponentMapping from "@/components/tina-markdown/markdown-component-mapping";
import RuleList from "@/components/rule-list";
import { useUser, getAccessToken } from "@auth0/nextjs-auth0";
import { BookmarkService } from "@/lib/bookmarkService";

export interface ClientCategoryPageProps {
  categoryQueryProps: {
    query: string;
    variables?: Record<string, any>;
    data?: any;
  };
}

export default function ClientCategoryPage(props: ClientCategoryPageProps) {
  const { categoryQueryProps } = props;

  const { data } = useTina({
    query: categoryQueryProps.query,
    variables: categoryQueryProps.variables ?? {},
    data: categoryQueryProps.data ?? {},
  });

  const { user, isLoading: authLoading } = useUser();
  const category = data?.category;
  const baseRules = useMemo(() => {
    return category?.index.flatMap(i => i.rule) || [];
  }, [category]);
  const [annotatedRules, setAnnotatedRules] = useState<any[]>(baseRules);
  const [bookmarkedGuids, setBookmarkedGuids] = useState<string[]>([]);
  const path = categoryQueryProps?.variables?.relativePath;

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
        const guids: string[] = (bookmarkResult?.bookmarkedRules || [])
          .map((b: any) => b?.ruleGuid)
          .filter((g: any): g is string => Boolean(g));
        if (!cancelled) setBookmarkedGuids(guids);
      } catch {
        if (!cancelled) setBookmarkedGuids([]);
      }
    }
    fetchBookmarks();
    return () => { cancelled = true; };
  }, [authLoading, user?.sub]);

  // Derive annotated rules when baseRules or bookmarks change
  useEffect(() => {
    if (!baseRules || baseRules.length === 0) {
      setAnnotatedRules([]);
      return;
    }
    const bookmarkSet = new Set(bookmarkedGuids);
    const updated = baseRules.map((r: any) => ({
      ...r,
      isBookmarked: r?.guid ? bookmarkSet.has(r.guid) : false,
    }));
    setAnnotatedRules(updated);
  }, [baseRules, bookmarkedGuids]);

  return (
    <div>
      {/* TODO: Breadcrumb */}
      <div className="flex">
        <div className="w-full lg:w-2/3 bg-white pt-4 p-6 rounded shadow">
          <h1 className="m-0 mb-2 text-ssw-red font-bold">{category?.title}</h1>
          <div data-tina-field={tinaField(category, "body")}
            className="text-md">
            <TinaMarkdown
              content={category?.body}
              components={MarkdownComponentMapping}
            />
          </div>
          <RuleList
            rules={annotatedRules}
            categoryUri={path}
            type="category" />
        </div>
        <div className="hidden lg:w-1/3 lg:block md:hidden p-6 pr-0">
          <ol className="border-l-3 border-gray-300 pl-6">
            {annotatedRules.map((rule) => (
              <li key={rule.guid} className="py-1 ml-4">
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
