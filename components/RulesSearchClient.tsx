'use client';

import { InstantSearch, SearchBox, Hits } from 'react-instantsearch-hooks-web';
import { useState } from 'react';
import { searchClient } from '@/lib/algoliaClient';
import SearchNavigator from './SearchNavigator';
import Link from 'next/link';

const Hit = ({ hit }: { hit: any }) => <Link href={`/${hit.slug}`}>{hit.title}</Link>;
const indexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!;

const sortOptions = [
    { value: 'Updated', label: 'Recently Updated', field: 'lastUpdated' },
    { value: 'Created', label: 'Recently Added', field: 'created' },
];

export default function RulesSearchClient({ keyword }: { keyword: string }) {
    const [submitted, setSubmitted] = useState(false);
    const [sortOption, setSortOption] = useState(sortOptions[0].value);

    const sortItems = (items: any[], sortBy: string) => {
        const sortField = sortOptions.find(option => option.value === sortBy)?.field;

        if (!sortField) {
            return items;
          }

        return items.sort((a, b) => {
            const aDate = a[sortField];
            const bDate = b[sortField];
    
            return new Date(bDate).getTime() - new Date(aDate).getTime();
        });
    };

    return (
        <InstantSearch
            searchClient={searchClient}
            indexName={indexName!}
            initialUiState={{ [indexName]: { query: keyword } }}
        >
            <SearchBox searchAsYouType={false} onSubmit={() => setSubmitted(true)} />

            <div className="sort-dropdown mb-4">
                <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="sort-select p-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2  transition ease-in-out duration-200"
                >
                    {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            <SearchNavigator submitted={submitted} reset={() => setSubmitted(false)} />
            <Hits hitComponent={Hit} transformItems={(items) => sortItems(items, sortOption)} />
        </InstantSearch>
    );
}
