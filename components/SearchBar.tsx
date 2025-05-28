'use client';

import { InstantSearch, SearchBox } from 'react-instantsearch-hooks-web';
import { useState } from 'react';
import { searchClient } from '@/lib/algoliaClient';
import SearchNavigator from './SearchNavigator';

export default function SearchBar() {
    const [submitted, setSubmitted] = useState(false);
    return (
        <InstantSearch searchClient={searchClient} indexName={process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!}>
            <SearchBox searchAsYouType={false} onSubmit={() => setSubmitted(true)} />
            <SearchNavigator submitted={submitted} reset={() => setSubmitted(false)} />
        </InstantSearch>
    );
}
