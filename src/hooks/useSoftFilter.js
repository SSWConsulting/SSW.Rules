import { useState } from 'react';

export default function useSortFilter(filterRefs) {
  const [filters, setFilters] = useState(filterRefs);

  function ClearFilters() {
    setFilters('');
  }

  return { filters, clear: ClearFilters, set: setFilters };
}
