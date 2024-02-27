import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import qs from 'query-string';
import algoliasearch from 'algoliasearch';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { navigate } from 'gatsby';

const SearchBar = ({ setIsLoaded, toSearch, setSearchResult, location }) => {
  const [query, setQuery] = useState('');
  const [queryString, setQueryString] = useState('');
  const [isShow, setIsShow] = useState(false);

  const searchClient = useMemo(() => {
    const client = algoliasearch(
      process.env.GATSBY_ALGOLIA_APP_ID,
      process.env.GATSBY_ALGOLIA_SEARCH_KEY
    );
    return client.initIndex('Rules');
  }, []);

  useEffect(() => {
    const searchString = qs.parse(location?.search).keyword;
    setQuery(searchString);
    setQueryString(searchString);
    setIsShow(true);
  }, []);

  useEffect(() => {
    fetchSearch(queryString);
  }, [queryString]);

  const handlePressEnter = (val) => {
    if (!val) return;
    if (toSearch) {
      navigate('/search?keyword=${val}');
    } else {
      fetchSearch(val);
    }
  };

  const fetchSearch = async (val) => {
    if (!val) return [];
    setIsLoaded(false);
    const results = await searchClient.search(val);
    const rawResults = results.hits;

    setSearchResult(rawResults);
    setIsLoaded(true);
  };

  return (
    <div
      className={`border border-solid border-gray-400 w-full flex items-center pl-3 p-2 rounded shadow ${
        isShow ? 'block' : 'hidden'
      }`}
    >
      <FontAwesomeIcon
        icon={faSearch}
        size="1x"
        className="text-gray-400 mr-2"
        aria-label="search"
      />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handlePressEnter(e.target.value);
          }
        }}
        type="text"
        placeholder=""
        className="w-full outline-none"
      />
    </div>
  );
};

export default SearchBar;

SearchBar.propTypes = {
  toSearch: PropTypes.bool,
  setSearchResult: PropTypes.func,
  setIsLoaded: PropTypes.func,
  location: PropTypes.object,
};
