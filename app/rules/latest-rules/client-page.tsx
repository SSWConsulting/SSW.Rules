'use client';

import { useState, useEffect } from 'react';
import client from '@/tina/__generated__/client';
import SearchBar from '@/components/SearchBar';
import Link from 'next/link';
import SortDropdown from '@/components/SortDropdown';

const sortOptions = [
  { value: 'Updated', label: 'Recently Updated', field: 'lastUpdated' },
  { value: 'Created', label: 'Recently Added', field: 'created' },
];

export default function ClientLatestRulesPage({ size }: { size: number }) {
  const [rules, setRules] = useState<any[]>([]);
  const [sortOption, setSortOption] = useState(sortOptions[0].value);

  const getLatestRules = async () => {
    try {
      const { data } = await client.queries.ruleConnection({});
      
      if (data?.ruleConnection?.edges) {
        const sortedRules = data.ruleConnection.edges
          .map((edge: any) => edge.node)
          .sort((a: any, b: any) => {
            const sortField = sortOptions.find(option => option.value === sortOption)?.field;

            if (!sortField) {
              return 0;
            }

            const aDate = new Date(a[sortField]).getTime();
            const bDate = new Date(b[sortField]).getTime();
            return bDate - aDate;
          });

        setRules(sortedRules);
      } else {
        console.error('No rules found');
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  };

  useEffect(() => {
    getLatestRules();
  }, [sortOption]);

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
