import React, { useEffect, useState } from 'react';

import LatestRulesContent from '../components/latest-rules-content/latestRulesContent';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import SideBar from '../components/side-bar/side-bar';
import { graphql } from 'gatsby';
import { objectOf } from 'prop-types';
import qs from 'query-string';
import { sanitizeName } from '../helpers/sanitizeName';
import { FilterOptions } from '../components/filter/filter';

const LatestRules = ({ data, location }) => {
  const [filter, setFilter] = useState();
  const [notFound, setNotFound] = useState(false);
  const [filteredItems, setFilteredItems] = useState({ list: [], filter: {} });
  const [isAscending, setIsAscending] = useState(true);
  const [githubRule, setGithubRule] = useState(null);
  const [startCursor, setStartCursor] = useState('');
  const [endCursor, setEndCursor] = useState('');

  const filterTitle = 'Results';
  const history = data.allHistoryJson.edges;
  const rules = data.allMarkdownRemark.nodes;
  const userRules = data.allCommitsJson.edges;

  const queryStringSearch = qs.parse(location?.search, {
    parseNumbers: true,
  });

  const queryStringRulesListSize = (() => {
    if (!queryStringSearch.size) {
      return 50;
    } else {
      return queryStringSearch.size > 100 ? 100 : queryStringSearch.size;
    }
  })();
  const queryStringRulesAuthor = queryStringSearch.author || '';

  useEffect(() => {
    // filterAndSort(filter);
  }, [filter, isAscending]);

  useEffect(() => {
    const fetchGithubData = async () => {
      const githubOwner = 'SSWConsulting';
      const githubRepo = 'SSW.Rules.Content';
      const apiBaseUrl = 'https://api.github.com/graphql';
      const token = process.env.GITHUB_API_PAT;

      const res = await fetch(apiBaseUrl, {
        method: 'POST',
        headers: {
          Authorization: `bearer ${token}`,
        },
        body: JSON.stringify({
          query: `{
            search( query: "repo:${githubOwner}/${githubRepo} is:pr base:main is:merged sort:updated-desc author:${queryStringRulesAuthor}"
            type: ISSUE
            first: 30) {
                pageInfo {
                    endCursor
                    startCursor
                }
                nodes {
                    ... on PullRequest {
                        files(first: 10) {
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
      })
        .then((res) => res.json())
        .catch((error) => {
          return error;
        });

      const resNodesArr = res.data.search.nodes;
      setStartCursor(res.data.search.pageInfo.startCursor);
      setEndCursor(res.data.search.pageInfo.endCursor);

      const newResNodesArr = [];

      for (let i = 0; i < resNodesArr.length; i++) {
        const kk = [...resNodesArr[i].files.nodes];
        const updatedTime = resNodesArr[i].mergedAt;

        kk.forEach((path) => {
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

          if (rule) {
            return { item: rule, file: r.file };
          } else {
            return null;
          }
        })
        .filter((result) => result !== null);

      setGithubRule(filteredRule);
      filterAndSort(FilterOptions.RecentlyUpdated);
    };

    fetchGithubData();
  }, []);

  const filterByAuthor = async (rulesList) => {
    const getCommitPathsFromRule = (rule) => {
      return rule.node.commits.flatMap((commit) => {
        return commit.FilesChanged.map((x) =>
          x.path.substring(0, x.path.lastIndexOf('/'))
        );
      });
    };

    // eslint-disable-next-line no-undef
    const filteredPathsSet = new Set(
      userRules
        .filter((rule) => rule.node.user === queryStringRulesAuthor)
        .flatMap(getCommitPathsFromRule)
    );

    const foundRules = rulesList.filter((item) => {
      return filteredPathsSet.has(sanitizeName(item.item.fields.slug, true));
    });

    return foundRules;
  };

  const filterAndValidateRules = async () => {
    const foundRules = await rules.map((item) => {
      //TODO: Depending on the speed - optimise this find
      let findRule = history.find(
        (r) => sanitizeName(r) === sanitizeName(item.fields.slug, true)
      );

      //Return if a rule isn't found in history.json,if its archived or if we have reached the count
      if (!findRule || item.frontmatter.archivedreason) {
        return;
      }
      return { item: item, file: findRule };
    });

    //Remove undefined and Return results
    return foundRules.filter((i) => i !== undefined);
  };

  const filterAndSort = async (_filter) => {
    if (!_filter) {
      return;
    }

    if (githubRule.length === 0) {
      setNotFound(true);
      return;
    } else {
      setNotFound(false);
    }

    setFilteredItems({
      list: githubRule,
      filter: _filter,
    });
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
    allCommitsJson {
      edges {
        node {
          id
          commits {
            CommitTime
            FilesChanged {
              title
              path
              uri
            }
          }
          user
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
