'use client';

import {
  InstantSearch,
  SearchBox,
  useInstantSearch,
} from 'react-instantsearch-hooks-web';
import { algoliasearch } from 'algoliasearch';
import { useState, useCallback, useEffect } from 'react';

const baseClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
  process.env.NEXT_PUBLIC_ALGOLIA_API_KEY!
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
          query: '',
          params: '',
          processingTimeMS: 0,
        })),
      });
    }
    return baseClient.search(requests);
  },
};

type Hit = {
  objectID: string;
  frontmatter: { title: string; [k: string]: any };
};

type Props = {
  onResults?: (hits: Hit[]) => void;
};

function ResultsCollector({
  submitted,
  reset,
  onResults,
}: {
  submitted: boolean;
  reset: () => void;
  onResults?: (hits: Hit[]) => void;
}) {
  const { results, status } = useInstantSearch();

  useEffect(() => {
    if (submitted && status === 'idle') {
      onResults?.((results?.hits ?? []) as Hit[]);
      reset();
    }
  }, [submitted, status, results, reset, onResults]);

  return null;
}

export default function SearchBar({ onResults }: Props) {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
  }, []);

  return (
    <div className="p-4">
      <InstantSearch searchClient={searchClient} indexName="index-json">
        <div className="max-w-xl mx-auto">
          <SearchBox searchAsYouType={false} onSubmit={handleSubmit} />
          <ResultsCollector
            submitted={submitted}
            reset={() => setSubmitted(false)}
            onResults={onResults}
          />
        </div>
      </InstantSearch>
    </div>
  );
}
