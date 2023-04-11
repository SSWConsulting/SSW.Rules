import React, { useEffect, useState } from 'react';

import { func } from 'prop-types';

export const FilterOptions = {
  RecentlyAdded: 'Recently Added',
  RecentlyUpdated: 'Recently Updated',
};

const Filter = ({ selected }) => {
  const [selectedOption, setSelectedOption] = useState(
    FilterOptions.RecentlyAdded
  );

  useEffect(() => {
    selected(selectedOption);
  }, [selectedOption]);

  return (
    <div className="relative inline-block text-left">
      <span className="mr-2">Sort by</span>
      <select
        id="sortFilter"
        name="sortFilter"
        className="text-start py-1 pl-3 text-base focus:outline-none focus:border-transparent"
        onChange={(e) => setSelectedOption(e.target.value)}
        onBlur={(e) => setSelectedOption(e.target.value)}
      >
        <option id="1">{FilterOptions.RecentlyAdded}</option>
        <option id="2">{FilterOptions.RecentlyUpdated}</option>
      </select>
    </div>
  );
};

export default Filter;

Filter.propTypes = {
  selected: func,
};
