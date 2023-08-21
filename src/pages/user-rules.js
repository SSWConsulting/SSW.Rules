import React, { useEffect, useState } from 'react';

import LatestRulesContent from '../components/latest-rules-content/latestRulesContent';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import SideBar from '../components/side-bar/side-bar';
import { graphql } from 'gatsby';
import { objectOf } from 'prop-types';
import qs from 'query-string';
import { FilterOptions } from '../components/filter/filter';

const LatestRules = ({ data, location }) => {
  const [notFound, setNotFound] = useState(false);
  const [filteredItems, setFilteredItems] = useState({ list: [], filter: {} });
  const [isAscending, setIsAscending] = useState(true);
  const [startCursor, setStartCursor] = useState([]);
  const [endCursor, setEndCursor] = useState('');
  const [temp, setTemp] = useState('');
  const [hasPrevious, setHasPrevious] = useState(false);
  const [hasNext, setHasNext] = useState(false);

  const filterTitle = 'Results';
  const rules = data.allMarkdownRemark.nodes;

  const queryStringSearch = qs.parse(location?.search, {
    parseNumbers: true,
  });

  const queryStringRulesAuthor = queryStringSearch.author || '';

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        const searchData = await fetchGithubData();
        const resultList = searchData.nodes;
        updateAndFilterRules(resultList);
      } catch (err) {
        setNotFound(true);
      }
    };

    fetchPageData();
  }, []);

  const fetchGithubData = async (action) => {
    const githubOwner = 'SSWConsulting';
    const githubRepo = 'SSW.Rules.Content';
    const apiBaseUrl = 'https://api.github.com/graphql';
    const token = process.env.GITHUB_API_PAT;

    if (action == 'after') {
      const newArr = [...startCursor, temp];
      setStartCursor(newArr);
    }

    const response = await fetch(apiBaseUrl, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
      },
      body: JSON.stringify({
        query: `{
            search( query: "repo:${githubOwner}/${githubRepo} is:pr base:main is:merged sort:updated-desc author:${queryStringRulesAuthor}"
            type: ISSUE
            first: 30
            ${
              action == 'before'
                ? `before: "${startCursor[startCursor.length - 1]}"`
                : ''
            }
            ${action == 'after' ? `after: "${endCursor}"` : ''}
            ) {
                pageInfo {
                  endCursor
                  startCursor
                  hasNextPage
                  hasPreviousPage
                }
                nodes {
                    ... on PullRequest {
                        files(first: 20) {
                          nodes {
                          path
                        }
                    }
                        mergedAt
                    }
                }
          }
        }`,
      }),
    });
    const data = await response.json();

    if (action == 'before') {
      startCursor.pop();
    }

    setEndCursor(data.data?.search?.pageInfo?.endCursor);
    setTemp(data.data?.search?.pageInfo?.startCursor);
    setHasPrevious(data.data?.search?.pageInfo?.hasPreviousPage);
    setHasNext(data.data?.search?.pageInfo?.hasNextPage);
    return data.data?.search;
  };

  const updateAndFilterRules = (resultList) => {
    const newResNodesArr = [];
    // eslint-disable-next-line no-undef
    const seenTitles = new Set();

    for (let i = 0; i < resultList.length; i++) {
      const nodes = [...resultList[i].files.nodes];
      const updatedTime = resultList[i].mergedAt;

      nodes.forEach((path) => {
        newResNodesArr.push({
          file: {
            node: {
              path: path.path.replace('rule.md', ''),
              lastUpdated: updatedTime,
            },
          },
        });
      });
    }
    const filteredRule = newResNodesArr
      .map((r) => {
        const rule = rules.find((rule) => {
          const newSlug = rule.fields.slug.slice(
            1,
            rule.fields.slug.length - 5
          );
          return newSlug === r.file.node.path;
        });

        if (rule && !seenTitles.has(rule.frontmatter.title)) {
          seenTitles.add(rule.frontmatter.title);
          return { item: rule, file: r.file };
        } else {
          return null;
        }
      })
      .filter((result) => result !== null);

    if (filteredRule.length === 0) {
      setNotFound(true);
      return;
    } else {
      setNotFound(false);
    }

    setFilteredItems({
      list: filteredRule,
      filter: FilterOptions.RecentlyUpdated,
    });
  };

  const handleChangePage = async (action) => {
    const searchData = await fetchGithubData(action);
    const resultList = searchData.nodes;
    updateAndFilterRules(resultList);
  };

  return (
    <div className="w-full">
      <Breadcrumb isLatest />
      <div className="container" id="rules">
        <div className="flex flex-wrap">
          <div className="w-full lg:w-3/4 px-4">
            <span className="flex">
              <h2 className="flex-1">Latest Rules</h2>
            </span>
            <div className="rule-index archive no-gutters rounded mb-12">
              <LatestRulesContent
                filteredItems={filteredItems}
                title={filterTitle}
                notFound={notFound}
                isAscending={isAscending}
                setIsAscending={setIsAscending}
              />
            </div>
            <div className="text-center">
              <button
                className={`m-3 p-2  rounded-md ${
                  hasPrevious
                    ? 'bg-ssw-red text-white'
                    : 'bg-ssw-grey text-text-gray-400'
                }`}
                onClick={() => handleChangePage('before')}
                disabled={!hasPrevious}
              >
                Previous
              </button>
              <button
                className={`m-3 p-2  rounded-md ${
                  hasNext
                    ? 'bg-ssw-red text-white'
                    : 'bg-ssw-grey text-text-gray-400'
                }`}
                onClick={() => handleChangePage('after')}
                disabled={!hasNext}
              >
                Next
              </button>
            </div>
          </div>
          <div className="w-full lg:w-1/4 px-4" id="sidebar">
            <SideBar ruleTotalNumber={rules.length} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const pageQuery = graphql`
  query latestRulesQuery {
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
