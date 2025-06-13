'use client';

import { useSearchParams } from 'next/navigation';
import SearchBar from '@/components/SearchBar';

export default function RulesSearchClientPage() {
    const searchParams = useSearchParams();
    const keyword = searchParams.get('keyword') || '';

    return <SearchBar keyword={keyword} />;
}
