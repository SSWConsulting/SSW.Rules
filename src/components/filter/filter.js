import React, { useEffect, useRef, useState } from 'react';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSortAmountDown } from '@fortawesome/free-solid-svg-icons';
import useSortFilter from '../../hooks/useSoftFilter';

export const FilterOptions = {
  Dc: 'Date Created',
  De: 'Date Edited',
};

const Filter = ({ selected }) => {
  const [selectedOption, setSelectedOption] = useState(FilterOptions.Dc);
  // const { filters, set, clear } = useSortFilter('');

  useEffect(() => {
    selected(selectedOption);
  }, [selectedOption]);

  return (
    <div className="relative inline-block text-left">
      <span>Sort by</span>
      <select
        id="sortFilter"
        name="sortFilter"
        className="text-start text-base focus:outline-none focus:border-transparent"
        onChange={(e) => setSelectedOption(e.target.value)}
        onBlur={(e) => setSelectedOption(e.target.value)}
      >
        <option id="1">{FilterOptions.Dc}</option>
        <option id="2">{FilterOptions.De}</option>
      </select>
    </div>
  );
};

export default Filter;
