import React, { useState, useEffect } from 'react';
import FlexSearch from 'flexsearch';
import PropTypes from 'prop-types';
import qs from 'query-string';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

const SearchBar = ({
  toSearch,
  publicIndexURL,
  publicStoreURL,
  setSearchResult,
  location,
}) => {
  const [query, setQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(null);
  const [searchStore, setSearchStore] = useState(null);
  const [index, setIndex] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const searchString = qs.parse(location?.search).keyword;
    setQuery(searchString);

    const fetchData = async () => {
      const indexResponse = await fetch(publicIndexURL);
      const indexData = await indexResponse.text();
      setSearchIndex(indexData);

      const storeResponse = await fetch(publicStoreURL);
      const storeData = await storeResponse.json();
      setSearchStore(storeData);

      setIsLoaded(true);
    };

    if (!toSearch) {
      fetchData();
    }
  }, []);

  const handlePressEnter = (val) => {
    if (!toSearch) return;
    const pathPrefix = process.env.NODE_ENV === 'development' ? '' : '/rules';
    window.location.href = `${pathPrefix}/search?keyword=${val}`;
  };

  const fetchSearch = async () => {
    if (!query || !index || !searchStore) return [];
    const rawResults = index.search(query);

    setSearchResult(rawResults.map((id) => searchStore[id]));
  };

  useEffect(() => {
    if (isLoaded) {
      fetchSearch();
    }
  }, [query, isLoaded]);

  useEffect(() => {
    if (!searchIndex) {
      setIndex(null);
      return;
    }
    if (searchIndex instanceof FlexSearch) {
      setIndex(searchIndex);
      return;
    }

    const importedIndex = FlexSearch.create();
    importedIndex.import(searchIndex);

    setIndex(importedIndex);
  }, [searchIndex]);

  return (
    <div className="border border-solid w-96 ml-4 flex items-center pl-3 p-2 rounded shadow bg-gray-50">
      <FontAwesomeIcon
        icon={faSearch}
        size="lg"
        className="text-gray-400 mr-2"
      />
      <input
        value={query}
        onInput={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handlePressEnter(e.target.value);
          }
        }}
        type="text"
        placeholder="I'm looking for..."
        className="w-full outline-none bg-gray-50"
      />
    </div>
  );
};

export default SearchBar;

SearchBar.propTypes = {
  toSearch: PropTypes.bool,
  publicIndexURL: PropTypes.string,
  publicStoreURL: PropTypes.string,
  setSearchResult: PropTypes.func,
  location: PropTypes.object,
};
