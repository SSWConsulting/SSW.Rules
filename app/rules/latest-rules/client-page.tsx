'use client';

import { useState, useEffect } from 'react';
import client from '@/tina/__generated__/client';
import SearchBar from '@/components/SearchBar';

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

      <div className="sort-dropdown mb-4">
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          className="sort-select p-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 transition ease-in-out duration-200"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        {displayedRules.map((rule: any) => (
          <div key={rule.id} className="py-2 border-b">
            <h3>{rule.title}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}
