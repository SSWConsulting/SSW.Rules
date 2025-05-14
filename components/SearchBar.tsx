'use client';

import {
  InstantSearch,
  SearchBox,
  Hits,
  connectStateResults,
} from 'react-instantsearch-dom';
import {algoliasearch} from 'algoliasearch';

const baseClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID as string,
  process.env.NEXT_PUBLIC_ALGOLIA_API_KEY as string
);

const searchClient = {
  ...baseClient,
  search(requests: any[]) {
    if (requests.every(({ params }) => !params.query)) {
      return Promise.resolve({
        results: requests.map(() => ({
          hits: [],
          nbHits: 0,
          page: 0,
          nbPages: 0,
          hitsPerPage: 20,
          exhaustiveNbHits: false,
          exhaustive: { nbHits: false },
          query: '',
          params: '',
          processingTimeMS: 0,
        })),
      });
    }
    return baseClient.search(requests);
  },
};

const Hit = ({ hit }: { hit: any }) => (
  <div className="py-2 border-b">{hit.frontmatter?.title}</div>
);

const Results = connectStateResults(({ searchState }) =>
  searchState?.query ? <Hits hitComponent={Hit} /> : null
);

export default function SearchBar() {
  return (
    <div className="p-4">
      <InstantSearch searchClient={searchClient} indexName="index-json">
        <div className="max-w-xl mx-auto">
          <SearchBox searchAsYouType={false} />
          <Results />
        </div>
      </InstantSearch>
    </div>
  );
}
