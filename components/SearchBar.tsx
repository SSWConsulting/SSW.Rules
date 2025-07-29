'use client';

import { useSearchBox, Hits, InstantSearch } from 'react-instantsearch-hooks-web';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { searchClient } from '@/lib/algoliaClient';
import SortDropdown from './SortDropdown';
import SearchNavigator from './SearchNavigator';
import { sortItems } from '@/utils/sortUtils';
import Link from 'next/link';
import { Search } from 'lucide-react';

const sortOptions = [
    { value: 'Updated', label: 'Recently Updated', field: 'lastUpdated' },
    { value: 'Created', label: 'Recently Added', field: 'created' },
];

const Hit = ({ hit }: { hit: any }) => <Link href={`/${hit.slug}`}>{hit.title}</Link>;

function CustomSearchBox({ onSubmit }: { onSubmit: (query: string) => void }) {
    const { query, refine } = useSearchBox();
    const [inputValue, setInputValue] = useState(query || '');
    const router = useRouter();

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed) {
            router.push('/');
        } else {
            refine(trimmed);
            onSubmit(trimmed);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-3">
            <div className="relative">
                <input
                    type="text"
                    className="block w-full h-10 pl-3 pr-10 py-2 bg-white border placeholder-slate-400 focus:ring-gray-400 rounded-md"
                    placeholder="Search..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                />
                <span
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                >
                    <Search className="w-5 h-5" />
                </span>
            </div>
        </form>
    );
}

export default function SearchBar({ keyword = '' }: { keyword?: string }) {
    const [submitted, setSubmitted] = useState(false);
    const [sortOption, setSortOption] = useState(sortOptions[0].value);

    return (
        <InstantSearch
            searchClient={searchClient}
            indexName={process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!}
            initialUiState={{
                [process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!]: {
                    query: keyword,
                },
            }}
        >
            <CustomSearchBox onSubmit={() => setSubmitted(true)} />
            <SortDropdown
                options={sortOptions}
                selectedValue={sortOption}
                onChange={setSortOption}
            />
            <SearchNavigator submitted={submitted} reset={() => setSubmitted(false)} />
            <Hits
                hitComponent={Hit}
                transformItems={(items) =>
                    sortItems(items, sortOption, sortOptions)
                }
            />
        </InstantSearch>
    );
}
