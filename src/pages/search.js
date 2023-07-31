import Filter, { FilterOptions } from '../components/filter/filter';
import React, { useEffect, useState } from 'react';

import LatestRulesContent from '../components/latest-rules-content/latestRulesContent';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import SideBar from '../components/side-bar/side-bar';
import SearchBar from '../components/search-bar/search-bar';
import { graphql } from 'gatsby';
import { objectOf } from 'prop-types';
import { sanitizeName } from '../helpers/sanitizeName';

const LatestRules = ({ data, location }) => {
  const [filter, setFilter] = useState();
  const [notFound, setNotFound] = useState(false);
  const [filteredItems, setFilteredItems] = useState({ list: [], filter: {} });
  const [isAscending, setIsAscending] = useState(true);
  const [searchResult, setSearchResult] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const filterTitle = 'Results';
  const history = data.allHistoryJson.edges;

  const { publicIndexURL, publicStoreURL } = data.localSearchPages;

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
    if (filteredRules.length === 0) {
      setNotFound(true);
      return;
    } else {
      setNotFound(false);
    }

    sort(_filter, filteredRules);

    setFilteredItems({
      list: filteredRules.slice(0, 50),
      filter: _filter,
    });
  };

  return (
    <div className="w-full">
      <Breadcrumb isSearch />
      <SearchBar
        isLoaded={isLoaded}
        setIsLoaded={setIsLoaded}
        publicIndexURL={publicIndexURL}
        publicStoreURL={publicStoreURL}
        setSearchResult={setSearchResult}
        location={location}
      />
      <div className="container" id="rules">
        <div className="flex flex-wrap">
          <div className="w-full lg:w-3/4 px-4">
            <span className="flex">
              <h2 className="flex-1">Search</h2>
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
            <SideBar ruleTotalNumber={rules?.length} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const pageQuery = graphql`
  query latestRulesQuery {
    localSearchPages {
      publicIndexURL
      publicStoreURL
    }
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
    allMarkdownRemark(filter: { frontmatter: { type: { eq: "rule" } } }) {
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

export default LatestRules;

LatestRules.propTypes = {
  data: objectOf(Object),
  location: objectOf(Object),
};
