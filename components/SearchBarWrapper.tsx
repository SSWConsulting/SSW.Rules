'use client';

import dynamic from 'next/dynamic';
import SearchBarSkeleton from './SearchBarSkeleton';

export interface SearchResult {
    objectID: string;
    title: string;
    slug: string;
    [key: string]: any;
}

export interface SearchBarProps {
    keyword?: string;
    sortBy?: string;
    onResults?: (results: SearchResult[]) => void;
}

const Inner = dynamic<SearchBarProps>(() => import('./SearchBar'), {
    ssr: false,
    loading: () => <SearchBarSkeleton />,
});

export default function SearchBarWrapper(props: SearchBarProps) {
    return <Inner {...props} />;
}


