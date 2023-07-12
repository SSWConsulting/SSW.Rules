import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

const SearchBar = ({ searchQuery, setSearchQuery }) => (
  <form className="border border-solid w-96 ml-4 flex items-center pl-3 p-2 rounded shadow bg-gray-50">
    <FontAwesomeIcon icon={faSearch} size="lg" className="text-gray-400 mr-2" />
    <input
      value={searchQuery}
      onInput={(e) => setSearchQuery(e.target.value)}
      type="text"
      id="header-search"
      placeholder="I'm looking for..."
      className="w-full outline-none bg-gray-50"
    />
  </form>
);

export default SearchBar;

SearchBar.propTypes = {
  searchQuery: PropTypes.func.isRequired,
  setSearchQuery: PropTypes.func.isRequired,
};
