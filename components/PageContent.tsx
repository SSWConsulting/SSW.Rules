'use client';

import { useState } from 'react';
import SearchBar from '@/components/SearchBar';
import HomeClientPage from '@/app/client-page';
import SearchResultsPage from './SearchResultsPage';

export default function PageContent({ categories }: { categories: any[] }) {
  const [hits, setHits] = useState<any[] | null>(null);

  return (
    <>
      <SearchBar onResults={setHits} />
      {hits ? (
        <SearchResultsPage hits={hits} />
      ) : (
        <HomeClientPage categories={categories} />
      )}
    </>
  );
}
