"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { InstantSearch, useHits, useInstantSearch, useSearchBox } from "react-instantsearch";
import useAppInsights from "@/components/hooks/useAppInsights";
import { searchClient } from "@/lib/algoliaClient";
import Spinner from "./Spinner";

interface SearchResult {
  objectID: string;
  title: string;
  slug: string;
  [key: string]: any;
}

interface SearchBarProps {
  keyword?: string;
  sortBy?: string;
  onResults?: (results: SearchResult[]) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  onQueryChange?: (query: string) => void;
  onInputValueChange?: (inputValue: string) => void;
}

function SearchResults({
  onResults,
  sortBy,
  onLoadingChange,
  onQueryChange,
}: {
  onResults?: (results: SearchResult[]) => void;
  sortBy?: string;
  onLoadingChange?: (isLoading: boolean) => void;
  onQueryChange?: (query: string) => void;
}) {
  const { hits } = useHits();
  const { status } = useInstantSearch();
  const { query } = useSearchBox();
  const { trackEvent } = useAppInsights();
  const hasTrackedRef = useRef<string>("");
  const lastIdsRef = useRef<string[]>([]);
  const lastSortRef = useRef<string>("relevance");

  useEffect(() => {
    const isLoading = status === "loading" || status === "stalled";
    onLoadingChange?.(isLoading);
  }, [status, onLoadingChange]);

  useEffect(() => {
    onQueryChange?.(query || "");
  }, [query, onQueryChange]);

  useEffect(() => {
    const sortedHits = [...hits] as unknown as SearchResult[];

    if (sortBy === "created") {
      sortedHits.sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime());
    } else if (sortBy === "lastUpdated") {
      sortedHits.sort((a, b) => new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime());
    }

    const sortLabel = sortBy ?? "relevance";
    const ids = sortedHits.map((h) => h.objectID);

    const sortChanged = sortLabel !== lastSortRef.current;
    const idsChanged = ids.length !== lastIdsRef.current.length || ids.some((id, i) => id !== lastIdsRef.current[i]);

    // Prevent infinite re-render loops caused by repeatedly pushing the same results
    if (sortChanged || idsChanged) {
      lastSortRef.current = sortLabel;
      lastIdsRef.current = ids;
      onResults?.(sortedHits);
    }

    // Track search results (only once per query to avoid duplicates)
    if (query && query.length >= 3 && status === "idle" && hasTrackedRef.current !== query) {
      trackEvent("SearchCompleted", {
        query: query,
        resultCount: sortedHits.length,
        sortBy: sortLabel,
        hasResults: sortedHits.length > 0,
      });
      hasTrackedRef.current = query;
    }
  }, [hits, onResults, sortBy, query, status, trackEvent]);

  return null;
}

function CustomSearchBox({
  onSubmit,
  onInputValueChange,
  keyword,
}: {
  onSubmit: (query: string) => void;
  onInputValueChange?: (value: string) => void;
  keyword?: string;
}) {
  const { query, refine } = useSearchBox();
  const { status } = useInstantSearch();
  const [inputValue, setInputValue] = useState(query || "");
  const router = useRouter();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastSubmitTimeRef = useRef<number>(0);
  const lastSubmittedQueryRef = useRef<string>("");

  const isLoading = status === "loading" || status === "stalled";

  // Notify parent of input value changes
  useEffect(() => {
    onInputValueChange?.(inputValue);
  }, [inputValue, onInputValueChange]);

  // Debounce search refinement
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer to refine search after 400ms of no typing
    debounceTimerRef.current = setTimeout(() => {
      const trimmed = inputValue.trim();

      // Only search if there are at least 3 characters
      if (trimmed.length >= 3) {
        refine(trimmed);
      } else if (trimmed.length === 0) {
        // If input is empty but keyword param exists, restore keyword search
        // Otherwise, clear search
        if (keyword && keyword.length >= 3) {
          refine(keyword);
        } else {
          refine("");
        }
      }
      // If less than 3 characters but not empty, don't search
    }, 400);

    // Cleanup timer on unmount or when inputValue changes
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputValue, refine, keyword]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const trimmed = inputValue.trim();

    // Prevent rapid submissions (throttle to 1000ms)
    const now = Date.now();
    const timeSinceLastSubmit = now - lastSubmitTimeRef.current;

    // Block if already submitting, too soon since last submit, or same query
    if (isSubmitting || timeSinceLastSubmit < 1000 || trimmed === lastSubmittedQueryRef.current) {
      return;
    }

    setIsSubmitting(true);
    lastSubmitTimeRef.current = now;

    if (!trimmed) {
      router.push("/");
      lastSubmittedQueryRef.current = "";
      setIsSubmitting(false);
    } else if (trimmed.length < 3) {
      // Don't search if less than 3 characters
      setIsSubmitting(false);
      return;
    } else {
      // Clear debounce timer and refine immediately on submit
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      refine(trimmed);
      router.push(`/search?keyword=${encodeURIComponent(trimmed)}`);
      onSubmit(trimmed);
      lastSubmittedQueryRef.current = trimmed;

      // Reset submitting state after a short delay
      setTimeout(() => {
        setIsSubmitting(false);
      }, 1000);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">
          <Search className="w-5 h-5" />
        </span>
        <input
          type="text"
          className="block w-full h-10 pl-10 pr-3 py-2 mb-4 bg-white border placeholder-slate-400 focus:ring-gray-400 rounded-md"
          placeholder="Search..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      </div>
    </form>
  );
}

export default function SearchBar({ keyword = "", sortBy, onResults, onLoadingChange, onQueryChange, onInputValueChange }: SearchBarProps) {
  const [submitted, setSubmitted] = useState(false);
  const indexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!;

  return (
    <InstantSearch
      searchClient={searchClient}
      indexName={indexName}
      initialUiState={{
        [indexName]: {
          query: keyword,
        },
      }}
    >
      <CustomSearchBox onSubmit={() => setSubmitted(true)} onInputValueChange={onInputValueChange} keyword={keyword} />
      <SearchResults onResults={onResults} sortBy={sortBy} onLoadingChange={onLoadingChange} onQueryChange={onQueryChange} />
    </InstantSearch>
  );
}
