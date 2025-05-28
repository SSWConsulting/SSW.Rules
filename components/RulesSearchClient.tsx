'use client';

import { InstantSearch, SearchBox, Hits } from 'react-instantsearch-hooks-web';
import { useState } from 'react';
import { searchClient } from '@/lib/algoliaClient';
import SearchNavigator from './SearchNavigator';
import Link from 'next/link';
import SortDropdown from './SortDropdown';
import { sortItems } from '@/utils/sortUtils';

const Hit = ({ hit }: { hit: any }) => <Link href={`/${hit.slug}`}>{hit.title}</Link>;
const indexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!;

const sortOptions = [
    { value: 'Updated', label: 'Recently Updated', field: 'lastUpdated' },
    { value: 'Created', label: 'Recently Added', field: 'created' },
];

export default function RulesSearchClient({ keyword }: { keyword: string }) {
    const [submitted, setSubmitted] = useState(false);
    const [sortOption, setSortOption] = useState(sortOptions[0].value);

    return (
        <InstantSearch
            searchClient={searchClient}
            indexName={indexName!}
            initialUiState={{ [indexName]: { query: keyword } }}
        >
            <SearchBox searchAsYouType={false} onSubmit={() => setSubmitted(true)} />
            <SortDropdown options={sortOptions} selectedValue={sortOption} onChange={setSortOption} />
            <SearchNavigator submitted={submitted} reset={() => setSubmitted(false)} />
            <Hits hitComponent={Hit} transformItems={(items) => sortItems(items, sortOption, sortOptions)} />
        </InstantSearch>
    );
}
