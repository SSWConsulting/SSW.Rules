'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import client from '@/tina/__generated__/client';
import SearchBar from '@/components/SearchBar';
import Link from 'next/link';
import SortDropdown from '@/components/SortDropdown';

const sortOptions = [
  { value: 'lastUpdated', label: 'Recently Updated' },
  { value: 'created', label: 'Recently Added' },
];

export default function LatestRuleClientPage() {
  const searchParams = useSearchParams();
  const sizeParam = parseInt(searchParams.get('size') || '', 10);
  const size = Number.isNaN(sizeParam) ? 50 : sizeParam;

  const [rules, setRules] = useState<any[]>([]);
  const [sortOption, setSortOption] = useState(sortOptions[0].value);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const { data } = await client.queries.latestRulesQuery({
          size,
          sortOption,
        });
        const sortedRules = data?.ruleConnection?.edges?.map((edge: any) => edge.node) || [];
        setRules(sortedRules);
      } catch (error) {
        console.error('Error fetching rules:', error);
      }
    };

    fetchRules();
  }, [sortOption, size]);

  const displayedRules = rules.slice(0, size);

  return (
    <div>
      <SearchBar />
      <SortDropdown options={sortOptions} selectedValue={sortOption} onChange={setSortOption} />
      <div>
        {displayedRules.map((rule: any) => (
          <div key={rule.id} className="py-2 border-b">
            <Link href={`/${rule._sys.filename}`}>{rule.title}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
