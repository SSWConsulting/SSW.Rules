'use client';

import { Search } from 'lucide-react';

export default function SearchBarSkeleton() {
  return (
    <div className="relative">
      <div className="block w-full h-10 pl-3 pr-10 py-2 mb-4 bg-gray-200 border border-gray-300 rounded-md animate-pulse">
        <div className="h-4 bg-gray-300 rounded w-20"></div>
      </div>
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        aria-hidden="true"
      >
        <Search className="w-5 h-5" />
      </span>
    </div>
  );
}
