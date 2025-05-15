'use client';

import { InstantSearch, SearchBox, Hits } from 'react-instantsearch-hooks-web';
import { useState } from 'react';
import { searchClient } from '@/lib/algoliaClient';
import SearchNavigator from './SearchNavigator';

const Hit = ({ hit }: { hit: any }) => <div className='py-2 border-b'>{hit.title}</div>;
const indexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!;

export default function RulesSearchClient({ keyword }: { keyword: string }) {
    const [submitted, setSubmitted] = useState(false);
    return (
        <InstantSearch
            searchClient={searchClient}
            indexName={indexName!}
            initialUiState={{ [indexName]: { query: keyword } }}
        >
            <SearchBox searchAsYouType={false} onSubmit={() => setSubmitted(true)} />
            <SearchNavigator submitted={submitted} reset={() => setSubmitted(false)} />
            <Hits hitComponent={Hit} />
        </InstantSearch>
    );
}
