import React, { useEffect, useState } from 'react';
import Filter, { FilterOptions } from '../components/filter/filter';

import { graphql } from 'gatsby';
import { objectOf } from 'prop-types';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import LatestRulesContent from '../components/latest-rules-content/latestRulesContent';
import SearchBar from '../components/search-bar/search-bar';
import SideBar from '../components/side-bar/side-bar';
import { sanitizeName } from '../helpers/sanitizeName';

const SearchRules = ({ data, location }) => {
  const [filter, setFilter] = useState();
  const [notFound, setNotFound] = useState(false);
  const [filteredItems, setFilteredItems] = useState({ list: [], filter: {} });
  const [isAscending, setIsAscending] = useState(true);
  const [searchResult, setSearchResult] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [filterTitle, setFilterTitle] = useState('Results - 0 rules');

  const history = data.allHistoryJson.edges;

  const unFlattenResults = (results) => {
    return results.map((x) => {
      const { title, slug } = x;
      return { frontmatter: { title }, fields: { slug } };
    });
  };
  const rules = unFlattenResults(searchResult);

  useEffect(() => {
    filterAndSort(filter);
  }, [filter, isAscending, searchResult]);

  const filterAndValidateRules = async () => {
    const foundRules = await rules?.map((item) => {
      let findRule = history.find(
        (r) => sanitizeName(r) === sanitizeName(item.fields.slug, true)
      );

      if (!findRule) {
        return;
      }
      return { item: item, file: findRule };
    });

    //Remove undefined and Return results
    return foundRules.filter((i) => i !== undefined);
  };

  const sort = (_filter, filteredRules) => {
    switch (_filter) {
      case FilterOptions.RecentlyAdded:
        filteredRules.sort((a, b) => {
          if (a.file.node.created < b.file.node.created) return 1;
          if (a.file.node.created > b.file.node.created) return -1;
          return 0;
        });
        break;
      case FilterOptions.RecentlyUpdated:
        filteredRules.sort((a, b) => {
          if (a.file.node.lastUpdated < b.file.node.lastUpdated) return 1;
          if (a.file.node.lastUpdated > b.file.node.lastUpdated) return -1;
          return 0;
        });
        break;
    }

    if (!isAscending) {
      filteredRules.reverse();
    }
  };

  const filterAndSort = async (_filter) => {
    if (!_filter) {
      return;
    }

    const filteredRules = await filterAndValidateRules();
    setFilterTitle(`Results - ${filteredRules.length} rules`);

    if (filteredRules.length === 0) {
      setNotFound(true);
      return;
    } else {
      setNotFound(false);
    }

    sort(_filter, filteredRules);

    setFilteredItems({
      list: filteredRules,
      filter: _filter,
    });
  };

  return (
    <div className="w-full">
      <Breadcrumb breadcrumbText="Search" />
      <div className="container" id="rules">
        <div className="flex flex-wrap">
          <div className="w-full lg:w-3/4 px-4">
            <SearchBar
              isLoaded={isLoaded}
              setIsLoaded={setIsLoaded}
              setSearchResult={setSearchResult}
              location={location}
            />
            <span className="flex">
              <h1 className="flex-1 text-3xl">Search</h1>
              <div className="flex items-center align-middle">
                <Filter selected={setFilter} />
              </div>
            </span>
            <div className="rule-index archive no-gutters rounded mb-12">
              <LatestRulesContent
                filteredItems={filteredItems}
                title={filterTitle}
                notFound={isLoaded ? notFound : isLoaded}
                isAscending={isAscending}
                setIsAscending={setIsAscending}
              />
            </div>
          </div>
          <div className="w-full lg:w-1/4 px-4" id="sidebar">
            <SideBar ruleTotalNumber={rules?.length} hideCount />
          </div>
        </div>
      </div>
    </div>
  );
};

export const pageQuery = graphql`
  query searchRulesQuery {
    allHistoryJson {
      edges {
        node {
          created
          createdBy
          lastUpdated
          lastUpdatedBy
          file
        }
      }
    }
    allMdx(filter: { frontmatter: { type: { eq: "rule" } } }) {
      nodes {
        frontmatter {
          title
          archivedreason
        }
        fields {
          slug
        }
      }
    }
  }
`;

export default SearchRules;

SearchRules.propTypes = {
  data: objectOf(Object),
  location: objectOf(Object),
};
