'use client';

import Link from 'next/link';

export default function SearchResultsPage({ hits }: { hits: any[] }) {
  console.log('hits', hits);
  return (
    <div className="space-y-2">
      {hits.map((hit) => (
        <Link
          key={hit.objectID}
          href={hit.frontmatter?.slug ?? '#'}
          className="block border p-2 rounded hover:bg-gray-50"
        >
          {hit.frontmatter?.title}
        </Link>
      ))}
    </div>
  );
}
