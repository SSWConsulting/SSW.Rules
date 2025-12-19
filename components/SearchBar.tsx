"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { InstantSearch, useHits, useSearchBox } from "react-instantsearch";
import { searchClient } from "@/lib/algoliaClient";

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
}

function SearchResults({ onResults, sortBy }: { onResults?: (results: SearchResult[]) => void; sortBy?: string }) {
  const { hits } = useHits();

  useEffect(() => {
    const sortedHits = [...hits] as unknown as SearchResult[];

    if (sortBy === "created") {
      sortedHits.sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime());
    } else if (sortBy === "lastUpdated") {
      sortedHits.sort((a, b) => new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime());
    }

    onResults?.(sortedHits);
  }, [hits, onResults, sortBy]);

  return null;
}

function CustomSearchBox({ onSubmit }: { onSubmit: (query: string) => void }) {
  const { query, refine } = useSearchBox();
  const [inputValue, setInputValue] = useState(query || "");
  const router = useRouter();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      router.push("/");
    } else {
      refine(trimmed);
      router.push(`/search?keyword=${encodeURIComponent(trimmed)}`);
      onSubmit(trimmed);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="relative">
        <input
          type="text"
          className="block w-full h-10 pl-3 pr-10 py-2 mb-4 bg-white border placeholder-slate-400 focus:ring-gray-400 rounded-md"
          placeholder="Search..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">
          <Search className="w-5 h-5" />
        </span>
      </div>
    </form>
  );
}

export default function SearchBar({ keyword = "", sortBy, onResults }: SearchBarProps) {
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
      <CustomSearchBox onSubmit={() => setSubmitted(true)} />
      <SearchResults onResults={onResults} sortBy={sortBy} />
    </InstantSearch>
  );
}
