"use client";

import { type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BreadcrumbCategory } from "@/components/Breadcrumbs";
import { CategoryReturnState, readCategoryReturnStates, requestScrollRestore, saveCategoryReturnState, takeListReturnRequest } from "@/lib/categoryReturnState";
import { normalizeRuleListSearch, parseRuleListSearch, toRuleListSearch } from "@/lib/ruleListUrlState";

/** Points category links at the page of the list the reader left, and restores their scroll position there. */
export function useCategoryReturnLinks(categories?: BreadcrumbCategory[]): BreadcrumbCategory[] | undefined {
  // Read after mount: sessionStorage doesn't exist during prerendering, and reading it in render would break hydration
  const [returnStates, setReturnStates] = useState<Record<string, CategoryReturnState>>({});

  useEffect(() => {
    setReturnStates(readCategoryReturnStates());
  }, []);

  return categories?.map((category) => {
    const categoryUri = category.link.replace(/^\//, "");
    const returnState = returnStates[categoryUri];
    if (!returnState) return category;

    return {
      ...category,
      link: `${category.link}${returnState.search}`,
      scroll: false,
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        // A modified click opens the list in another tab or window; this tab isn't navigating to it
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        requestScrollRestore(categoryUri);
      },
    };
  });
}

/**
 * On a category page: remembers where the reader left the list, and restores it when they return via a category link.
 * `renderedSearch` is the list query the page is rendering now, normalized.
 */
export function useCategoryListReturnPosition(categoryUri: string | undefined, renderedSearch: string) {
  const pendingScrollRef = useRef<{ search: string; scrollY: number } | null>(null);

  useLayoutEffect(() => {
    if (!categoryUri) return;
    const request = takeListReturnRequest(categoryUri);
    if (!request) return;
    // Client navigation to this prerendered route can land without the link's query, so apply the saved list query here
    const url = new URL(window.location.href);
    if (normalizeRuleListSearch(url.search) !== request.search) {
      url.search = toRuleListSearch(parseRuleListSearch(request.search), url.search);
      window.history.replaceState(null, "", url);
    }
    pendingScrollRef.current = request;
  }, [categoryUri]);

  // Scroll only once the list renders the saved page; a restored query re-renders the page after the effect above
  useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending || pending.search !== renderedSearch) return;
    pendingScrollRef.current = null;
    window.scrollTo(0, pending.scrollY);
  }, [renderedSearch]);

  useEffect(() => {
    if (!categoryUri) return;
    // Save on link click: by the time the page unmounts, the navigation has already shrunk the page and reset the scroll
    const onLinkClick = (event: globalThis.MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) {
        saveCategoryReturnState(categoryUri, normalizeRuleListSearch(window.location.search), window.scrollY);
      }
    };
    document.addEventListener("click", onLinkClick, true);
    return () => document.removeEventListener("click", onLinkClick, true);
  }, [categoryUri]);
}
