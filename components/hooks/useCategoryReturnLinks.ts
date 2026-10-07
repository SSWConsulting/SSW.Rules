"use client";

import { type MouseEvent, useEffect, useLayoutEffect, useState } from "react";
import type { BreadcrumbCategory } from "@/components/Breadcrumbs";
import { CategoryReturnState, readCategoryReturnStates, requestScrollRestore, saveCategoryReturnState, takeScrollRestore } from "@/lib/categoryReturnState";
import { normalizeRuleListSearch } from "@/lib/ruleListUrlState";

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

/** On a category page: remembers where the reader left the list, and restores it when they return via a category link. */
export function useCategoryListReturnPosition(categoryUri?: string) {
  useLayoutEffect(() => {
    if (!categoryUri) return;
    const scrollY = takeScrollRestore(categoryUri, normalizeRuleListSearch(window.location.search));
    if (scrollY !== null) window.scrollTo(0, scrollY);
  }, [categoryUri]);

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
