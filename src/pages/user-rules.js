import React, { useEffect, useState } from 'react';

import LatestRulesContent from '../components/latest-rules-content/latestRulesContent';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import SideBar from '../components/side-bar/side-bar';
import { graphql } from 'gatsby';
import { objectOf } from 'prop-types';
import qs from 'query-string';
import { FilterOptions } from '../components/filter/filter';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  },
});

const ActionTypes = {
  BEFORE: 'before',
  AFTER: 'after',
};

const UserRules = ({ data, location }) => {
  const [notFound, setNotFound] = useState(false);
  const [filteredItems, setFilteredItems] = useState({ list: [], filter: {} });
  const [isAscending, setIsAscending] = useState(true);
  const [previousPageCursor, setPreviousPageCursor] = useState([]);
  const [nextPageCursor, setNextPageCursor] = useState('');
  const [tempCursor, setTempCursor] = useState('');
  const [hasPrevious, setHasPrevious] = useState(false);
  const [hasNext, setHasNext] = useState(false);

  const filterTitle = 'Results';
  const rules = data.allMarkdownRemark.nodes;

  const queryStringSearch = qs.parse(location?.search, {
    parseNumbers: true,
  });

  const queryStringRulesAuthor = queryStringSearch.author || '';

  useEffect(() => {
    fetchPageData();
  }, []);

  const fetchPageData = async (action) => {
    try {
      const searchData = await fetchGithubData(action);
      const resultList = searchData.nodes;
      const extractedFiles = getExtractedFiles(resultList);
      const filteredRules = filterUniqueRules(extractedFiles);
      updateFilteredItems(filteredRules);
    } catch (err) {
      setNotFound(true);
      appInsights.trackException({
        error: new Error(err),
        severityLevel: 3,
      });
    }
  };

  const fetchGithubData = async (action) => {
    const githubOwner = process.env.GITHUB_ORG;
    const githubRepo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_API_PAT;
    const apiBaseUrl = 'https://api.github.com/graphql';

    let cursorQuery = '';
    if (action === ActionTypes.BEFORE) {
      cursorQuery = `before: "${
        previousPageCursor[previousPageCursor.length - 1]
      }"`;
    } else if (action === ActionTypes.AFTER) {
      setPreviousPageCursor([...previousPageCursor, tempCursor]);
      cursorQuery = `after: "${nextPageCursor}"`;
    }

    const query = `
        {
          search( query: "repo:${githubOwner}/${githubRepo} is:pr base:${process.env.CONTENT_BRANCH} is:merged sort:updated-desc author:${queryStringRulesAuthor}"
          type: ISSUE
          first: 30
          ${cursorQuery}
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
      }
    `;

    const response = await fetch(apiBaseUrl, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API request failed with status: ${response.status}`
      );
    }

    const data = await response.json();

    if (action === ActionTypes.BEFORE) {
      previousPageCursor.pop();
    }

    const { endCursor, startCursor, hasPreviousPage, hasNextPage } =
      data.data?.search?.pageInfo;

    setNextPageCursor(endCursor);
    setTempCursor(startCursor);
    setHasPrevious(hasPreviousPage);
    setHasNext(hasNextPage);

    return data.data?.search;
  };

  const getExtractedFiles = (resultList) => {
    const extractedFiles = [];

    for (let i = 0; i < resultList.length; i++) {
      const nodes = [...resultList[i].files.nodes];
      const updatedTime = resultList[i].mergedAt;

      nodes.forEach((path) => {
        extractedFiles.push({
          file: {
            node: {
              path: path.path.replace('rule.md', ''),
              lastUpdated: updatedTime,
            },
          },
        });
      });
    }

    return extractedFiles;
  };

  const filterUniqueRules = (extractedFiles) => {
    // eslint-disable-next-line no-undef
    const uniqueRuleTitles = new Set();

    const filteredRules = extractedFiles
      .map((r) => {
        const rule = rules.find((rule) => {
          const newSlug = rule.fields.slug.slice(
            1,
            rule.fields.slug.length - 5
          );
          return newSlug === r.file.node.path;
        });

        if (rule && !uniqueRuleTitles.has(rule.frontmatter.title)) {
          uniqueRuleTitles.add(rule.frontmatter.title);
          return { item: rule, file: r.file };
        } else {
          return null;
        }
      })
      .filter((result) => result !== null);

    return filteredRules;
  };

  const updateFilteredItems = (filteredRule) => {
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

  return (
    <div className="w-full">
      <Breadcrumb isUser />
      <div className="container" id="rules">
        <div className="flex flex-wrap">
          <div className="w-full lg:w-3/4 px-4">
            <span className="flex">
              <h2 className="flex-1">User Rules</h2>
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
            <div className="text-center mb-4">
              <button
                className={`m-3 mx-6 p-2 w-24 rounded-md ${
                  hasPrevious
                    ? 'bg-ssw-red text-white'
                    : 'bg-ssw-grey text-gray-400'
                }`}
                onClick={() => fetchPageData(ActionTypes.BEFORE)}
                disabled={!hasPrevious}
              >
                Previous
              </button>
              <button
                className={`m-3 mx-6 p-2 w-24 rounded-md ${
                  hasNext
                    ? 'bg-ssw-red text-white'
                    : 'bg-ssw-grey text-gray-400'
                }`}
                onClick={() => fetchPageData(ActionTypes.AFTER)}
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

export default UserRules;

UserRules.propTypes = {
  data: objectOf(Object),
  location: objectOf(Object),
};
