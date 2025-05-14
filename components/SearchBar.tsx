'use client';

import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { InstantSearch, SearchBox, useInstantSearch } from 'react-instantsearch-hooks-web';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const base = algoliasearch(process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!, process.env.NEXT_PUBLIC_ALGOLIA_API_KEY!);

export const searchClient = {
    ...base,
    search(requests) {
        const list = Array.isArray(requests) ? requests : [requests];
        if (list.every((r) => 'params' in r && !r.params?.query)) {
            return Promise.resolve({
                results: list.map(() => ({
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
            }) as any;
        }
        return base.search(requests as any);
    },
};

export default function SearchBar() {
    const [submitted, setSubmitted] = useState(false);
    const router = useRouter();

    const Navigator = () => {
        const { results, status } = useInstantSearch();
        useEffect(() => {
            if (submitted && status === 'idle') {
                router.push(`/rules/search?keyword=${encodeURIComponent(results?.query ?? '')}`);
                setSubmitted(false);
            }
        }, [submitted, status, results, router]);
        return null;
    };

    return (
        <InstantSearch searchClient={searchClient} indexName='index-json'>
            <SearchBox searchAsYouType={false} onSubmit={() => setSubmitted(true)} />
            <Navigator />
        </InstantSearch>
    );
}
