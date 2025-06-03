'use client';

import { Hits, InstantSearch, SearchBox } from 'react-instantsearch-hooks-web';
import { useState } from 'react';
import { searchClient } from '@/lib/algoliaClient';
import SearchNavigator from './SearchNavigator';
import SortDropdown from './SortDropdown';
import { sortItems } from '@/utils/sortUtils';
import Link from 'next/link';

const sortOptions = [
    { value: 'Updated', label: 'Recently Updated', field: 'lastUpdated' },
    { value: 'Created', label: 'Recently Added', field: 'created' },
];
const Hit = ({ hit }: { hit: any }) => <Link href={`/${hit.slug}`}>{hit.title}</Link>;

export default function SearchBar({ keyword = '' }: { keyword?: string }) {
    const [submitted, setSubmitted] = useState(false);
    const [sortOption, setSortOption] = useState(sortOptions[0].value);

    return (
        <InstantSearch
            searchClient={searchClient}
            indexName={process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!}
            initialUiState={{ [process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!]: { query: keyword } }}
        >
            <SearchBox
                classNames={{
                    root: 'p-3',
                    form: 'relative',
                    input: 'block w-full h-10 pl-9 pr-3 py-2 bg-white border border-slate-300 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-sky-500 rounded-md focus:ring-1',
                    submitIcon: 'absolute top-3 left-3 bottom-0 w-4 h-4',
                    resetIcon: 'hidden',
                }}
                searchAsYouType={false}
                onSubmit={() => setSubmitted(true)}
            />
            <SortDropdown options={sortOptions} selectedValue={sortOption} onChange={setSortOption} />
            <SearchNavigator submitted={submitted} reset={() => setSubmitted(false)} />
            <Hits hitComponent={Hit} transformItems={(items) => sortItems(items, sortOption, sortOptions)} />
        </InstantSearch>
    );
}
