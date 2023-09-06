import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import qs from 'query-string';
import algoliasearch from 'algoliasearch';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

const SearchBar = ({
  isLoaded,
  toSearch,
  setSearchResult,
  location,
  setIsLoaded,
}) => {
  const [query, setQuery] = useState('');

  const searchClient = useMemo(
    () =>
      algoliasearch(
        process.env.GATSBY_ALGOLIA_APP_ID,
        process.env.GATSBY_ALGOLIA_SEARCH_KEY
      ),
    []
  );

  useEffect(() => {
    const searchString = qs.parse(location?.search).keyword;
    setQuery(searchString);

    const fetchData = async () => {
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
    if (!query) return [];
    const { results } = await searchClient.search([
      {
        indexName: 'Pages',
        query,
      },
    ]);
    const rawResults = results[0].hits;

    setSearchResult(rawResults);
  };

  useEffect(() => {
    if (isLoaded) {
      fetchSearch();
    }
  }, [query, isLoaded]);

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
  isLoaded: PropTypes.bool,
  setSearchResult: PropTypes.func,
  setIsLoaded: PropTypes.func,
  location: PropTypes.object,
};
