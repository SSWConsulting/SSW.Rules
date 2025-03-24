import React, { useEffect, useState } from 'react';
import LatestRulesContent from '@/components/latest-rules-content/latestRulesContent';
import Breadcrumb from '@/components/breadcrumb/breadcrumb';
import SideBar from '@/components/side-bar/side-bar';
import { graphql, useStaticQuery } from 'gatsby';
import qs from 'query-string';
import { FilterOptions } from '@/components/filter/filter';
import useAppInsights from '../../hooks/useAppInsights';
import PropTypes from 'prop-types';

const ActionTypes = {
  BEFORE: 'before',
  AFTER: 'after',
};

const UserRules = ({ data, location }) => {
  const [notFound, setNotFound] = useState(false);
  const [noAuthorRules, setNoAuthorRules] = useState(false);
  const [filteredItems, setFilteredItems] = useState({ list: [], filter: {} });
  const [author, setAuthor] = useState({});
  const [authorRules, setAuthorRules] = useState({
    list: [],
    filter: {},
  });
  const [isAscending, setIsAscending] = useState(true);
  const [previousPageCursor, setPreviousPageCursor] = useState([]);
  const [nextPageCursor, setNextPageCursor] = useState('');
  const [tempCursor, setTempCursor] = useState('');
  const [hasNext, setHasNext] = useState(false);
  const { trackException } = useAppInsights();

  const filterTitle = 'Results';
  const rules = data.rules.nodes;
  // eslint-disable-next-line no-undef
  const uniqueRuleTitles = new Set();

  const queryStringSearch = qs.parse(location?.search, {
    parseNumbers: true,
  });
  const queryStringRulesAuthor = queryStringSearch.author || '';

  const normalizeName = (name) => {
    return name
      .normalize('NFD')
      .replace('ø', 'oe')
      .replace(/\p{Diacritic}/gu, '');
  };

  useEffect(() => {
    const author = data.crmData.nodes.find(
      (user) =>
        user.gitHubUrl && user.gitHubUrl.includes(queryStringRulesAuthor)
    );
    if (author && author.fullName) {
      author.fullName = normalizeName(author.fullName);
      setAuthor(author);
    } else {
      setNotFound(true);
      setNoAuthorRules(true);
    }
  });

  useEffect(() => {
    if (author.fullName) {
      fetchPageData();
    }
  }, [author]);

  const fetchPageData = async (action) => {
    try {
      const searchData = await fetchGithubData(action);
      const resultList = searchData.nodes;
      const extractedFiles = getExtractedFiles(resultList);
      const filteredRules = filterUniqueRules(extractedFiles);
      updateFilteredItems(filteredRules);
    } catch (err) {
      setNotFound(true);
      trackException(err, 3);
    }
  };

  const fetchGithubData = async (action) => {
    const githubOwner = process.env.GITHUB_ORG;
    const githubRepo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_API_PAT;
    const resultPerPage = 40;
    const filesPerPullRequest = 20;
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
          first: ${resultPerPage}
          ${cursorQuery}
          ) {
              pageInfo {
                endCursor
                startCursor
                hasNextPage
              }
              nodes {
                  ... on PullRequest {
                      files(first: ${filesPerPullRequest}) {
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

    const { endCursor, startCursor, hasNextPage } = data.data.search.pageInfo;

    setNextPageCursor(endCursor || null);
    setTempCursor(startCursor || null);
    setHasNext(hasNextPage || null);

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
              path: getRulePath(path.path),
              lastUpdated: updatedTime,
            },
          },
        });
      });
    }

    return extractedFiles;
  };

  const getRulePath = (path) => {
    const lastSlashIndex = path.lastIndexOf('/');
    if (
      path.includes('.md') &&
      !path.includes('categories') &&
      lastSlashIndex !== -1
    ) {
      return path.substring(0, lastSlashIndex + 1);
    } else {
      return path;
    }
  };

  const filterUniqueRules = (extractedFiles) => {
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
    const mergedList = [...filteredItems.list];

    filteredRule.forEach((ruleItem) => {
      const isDuplicate = mergedList.some(
        (mergedItem) => mergedItem.file.node.path === ruleItem.file.node.path
      );

      if (!isDuplicate) {
        mergedList.push(ruleItem);
      }
    });

    const acknowledgmentsList = mergedList.filter((ruleItem) => {
      const authorList = ruleItem.item.frontmatter.authors?.flatMap(
        (author) => author.title
      );

      return authorList.includes(author.fullName);
    });

    setNotFound(mergedList.length === 0);
    setNoAuthorRules(acknowledgmentsList.length === 0);

    setFilteredItems({
      list: mergedList,
      filter: FilterOptions.RecentlyUpdated,
    });

    setAuthorRules({
      list: acknowledgmentsList,
      filter: FilterOptions.RecentlyUpdated,
    });
  };

  const toggleSortOrder = (order) => {
    filteredItems.list?.reverse();
    authorRules.list?.reverse();
    setIsAscending(order);
  };

  return (
    <div className="w-full">
      <Breadcrumb
        breadcrumbText={
          author.fullName ? `${author.fullName}'s Rules` : 'User Rules'
        }
      />
      <div className="container" id="rules">
        <div className="flex flex-wrap">
          <div className="w-full lg:w-3/4 px-4">
            {author.fullName && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <h2 className="text-ssw-red">{author.fullName}&#39;s Rules</h2>

                <a
                  href={`https://ssw.com.au/people/${author.slug}/`}
                  className="underline unstyled hover:text-ssw-red"
                >
                  View people profile
                </a>
              </div>
            )}

            <hr className="mt-1 sm:mt-0" />

            <h3 className="text-ssw-red">
              Last Modified ({filteredItems.list.length})
            </h3>

            <div className="rule-index archive no-gutters rounded mb-12">
              <LatestRulesContent
                filteredItems={filteredItems}
                title={filterTitle}
                notFound={notFound}
                isAscending={isAscending}
                setIsAscending={toggleSortOrder}
              />
            </div>

            <h3 className="text-ssw-red">
              Acknowledged ({authorRules.list.length})
            </h3>

            <div className="rule-index archive no-gutters rounded mb-12">
              <LatestRulesContent
                filteredItems={authorRules}
                title={filterTitle}
                notFound={noAuthorRules}
                isAscending={isAscending}
                setIsAscending={toggleSortOrder}
              />
            </div>

            <div className="text-center mb-4">
              <button
                className={`m-3 mx-6 p-2 w-32 rounded-md ${
                  hasNext
                    ? 'bg-ssw-red text-white'
                    : 'bg-ssw-grey text-gray-400'
                }`}
                onClick={() => fetchPageData(ActionTypes.AFTER)}
                disabled={!hasNext}
              >
                Load More
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

UserRules.propTypes = {
  data: PropTypes.object.isRequired,
  location: PropTypes.object,
};

function UserRulesWithQuery(props) {
  const data = useStaticQuery(graphql`
    query LatestRulesQuery {
      rules: allMarkdownRemark(
        filter: { frontmatter: { type: { eq: "rule" } } }
      ) {
        nodes {
          frontmatter {
            title
            archivedreason
            authors {
              title
            }
          }
          fields {
            slug
          }
        }
      }
      crmData: allCrmDataCollection {
        nodes {
          id
          fullName
          slug
          isActive
          nickname
          location
          jobTitle
          role
          skypeUsername
          twitterUsername
          gitHubUrl
          blogUrl
          facebookUrl
          linkedInUrl
        }
      }
    }
  `);

  return <UserRules data={data} {...props} />;
}

export default UserRulesWithQuery;
