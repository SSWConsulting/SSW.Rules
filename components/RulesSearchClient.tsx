'use client';
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import type { SearchClient } from 'instantsearch.js';
import {
  InstantSearch,
  SearchBox,
  useInstantSearch,
  Hits,
} from 'react-instantsearch-hooks-web';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Base v5 client
const baseClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
  process.env.NEXT_PUBLIC_ALGOLIA_API_KEY!
);

/**
 * Wrap the v5 client so its `search()` signature matches what
 * react-instantsearch expects.
 */
const searchClient: SearchClient = {
  ...baseClient,
  search(requests) {
    // Empty-query shortcut
    const reqs = Array.isArray(requests) ? requests : [requests];
    if (reqs.every(r => 'params' in r && !r.params?.query)) {
      return Promise.resolve({
        results: reqs.map(() => ({
          hits: [],
          nbHits: 0,
          page: 0,
          nbPages: 0,
          hitsPerPage: 20,
          exhaustiveNbHits: false,
          query: '',
          params: '',
          processingTimeMS: 0,
        })),
      }) as any;       // cast keeps TS happy
    }
    // Delegate to v5 client
    return baseClient.search(requests as any);
  },
};

export default function RulesSearchClient({ keyword }: { keyword: string }) {
  const Hit = ({ hit }: { hit: any }) => (
    <div className="py-2 border-b">{hit.frontmatter?.title}</div>
  );

  return (
    <InstantSearch
      searchClient={searchClient}
      indexName="index-json"
      initialUiState={{ 'index-json': { query: keyword } }}
    >
      <SearchBox searchAsYouType={false} />
      <Hits hitComponent={Hit} />
    </InstantSearch>
  );
}