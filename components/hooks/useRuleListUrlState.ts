"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { saveCategoryReturnState, takeScrollRestore } from "@/lib/categoryReturnState";
import { DEFAULT_RULE_LIST_URL_STATE, parseRuleListSearch, RuleListPerPage, RuleListUrlState, toRuleListSearch } from "@/lib/ruleListUrlState";

// Category pages are prerendered with `force-static`, so the server never sees the query string.
// The list state is read from and written to the URL on the client instead.
export function useRuleListUrlState(categoryUri?: string) {
  const [state, setState] = useState<RuleListUrlState>(DEFAULT_RULE_LIST_URL_STATE);
  const [isUrlStateLoaded, setIsUrlStateLoaded] = useState(false);
  // Refs hold the latest values so the setters stay stable and two updates in one event don't overwrite each other
  const stateRef = useRef(state);
  const searchRef = useRef("");

  useLayoutEffect(() => {
    const fromUrl = parseRuleListSearch(window.location.search);
    stateRef.current = fromUrl;
    searchRef.current = toRuleListSearch(fromUrl, "");
    setState(fromUrl);
    setIsUrlStateLoaded(true);
  }, []);

  useLayoutEffect(() => {
    if (!isUrlStateLoaded || !categoryUri) return;
    const scrollY = takeScrollRestore(categoryUri, searchRef.current);
    if (scrollY !== null) window.scrollTo(0, scrollY);
  }, [isUrlStateLoaded, categoryUri]);

  useEffect(() => {
    if (!categoryUri) return;
    // Save on link click: by the time the page unmounts, the navigation has already shrunk the page and reset the scroll
    const onLinkClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) {
        saveCategoryReturnState(categoryUri, searchRef.current, window.scrollY);
      }
    };
    document.addEventListener("click", onLinkClick, true);
    return () => document.removeEventListener("click", onLinkClick, true);
  }, [categoryUri]);

  const update = useCallback((patch: Partial<RuleListUrlState>) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    setState(next);
    searchRef.current = toRuleListSearch(next, "");
    const url = new URL(window.location.href);
    url.search = toRuleListSearch(next, url.search);
    window.history.replaceState(null, "", url);
  }, []);

  return {
    state,
    setPage: useCallback((page: number) => update({ page }), [update]),
    setPerPage: useCallback((perPage: RuleListPerPage) => update({ perPage, page: 1 }), [update]),
    setView: useCallback((view: RuleListUrlState["view"]) => update({ view }), [update]),
    setIncludeArchived: useCallback((includeArchived: boolean) => update({ includeArchived, page: 1 }), [update]),
  };
}
