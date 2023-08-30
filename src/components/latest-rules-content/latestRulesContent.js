import { bool, func, object, objectOf, string } from 'prop-types';

import { FilterOptions } from '../filter/filter';
import Heading from '../heading/heading';
import { Link, navigate } from 'gatsby';
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import locale from 'date-fns/locale/en-AU';
import { sanitizeName } from '../../helpers/sanitizeName';

const LatestRulesContent = ({
  filteredItems,
  title,
  notFound,
  isAscending,
  setIsAscending,
  isShowAuthor,
}) => {
  const formatDistanceLocale = {
    lessThanXSeconds: '{{count}} sec',
    xSeconds: '{{count}} sec',
    halfAMinute: '30sec',
    lessThanXMinutes: '{{count}} min',
    xMinutes: '{{count}} min',
    aboutXHours: '{{count}} hour',
    xHours: '{{count}} hour',
    xDays: '{{count}} day',
    aboutXWeeks: '{{count}} week',
    xWeeks: '{{count}} week',
    aboutXMonths: '{{count}} month',
    xMonths: '{{count}} month',
    aboutXYears: '{{count}} year',
    xYears: '{{count}} year',
    overXYears: '{{count}} year',
    almostXYears: '{{count}} year',
  };

  const formatDistance = (token, count, options = {}) => {
    const result = formatDistanceLocale[token].replace('{{count}}', count);

    if (options.addSuffix && count > 1) {
      return `${result}s`;
    }

    return result;
  };

  const FormatDate = ({ item }) => (
    <span className="block text-light-grey text-right">
      {filteredItems.filter === FilterOptions.RecentlyUpdated
        ? formatDistanceToNow(new Date(item.file.node.lastUpdated), {
            locale: {
              ...locale,
              formatDistance,
            },
            addSuffix: true,
          })
        : formatDistanceToNow(new Date(item.file.node.created), {
            locale: {
              ...locale,
              formatDistance,
            },
            addSuffix: true,
          })}
    </span>
  );

  const sanitizeRule = (item) => {
    let rule = sanitizeName(item, true);
    return rule.slice(6, rule.length);
  };

  const openUserRule = async (path) => {
    const loginName = await fetchGithubName(path);
    const pathPrefix = process.env.NODE_ENV === 'development' ? '' : '/rules';
    navigate(`${pathPrefix}/user-rules/?author=${loginName}`);
  };

  const fetchGithubName = async (path) => {
    const githubOwner = process.env.GITHUB_ORG;
    const githubRepo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_API_PAT;
    const response = await fetch(
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/commits?path=${path}`,
      {
        headers: {
          Authorization: `bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `GitHub API request failed with status: ${response.status}`
      );
    }

    const data = await response.json();
    const loginName = data[data.length - 1]?.author?.login;

    return loginName;
  };

  return (
    <section className="mb-5 relative">
      <Heading
        title={title}
        isAscending={isAscending}
        setIsAscending={setIsAscending}
        isShowAuthor={isShowAuthor}
      >
        {!notFound ? (
          filteredItems.list.map((item, idx) => {
            return (
              <div
                key={idx}
                className={`cat-grid-container ${
                  isShowAuthor ? 'lg:grid-cols-[2rem_auto_8rem_4rem]' : ''
                }`}
              >
                <div className="cat-rule-num">{idx + 1}.</div>
                <div className={`text-left ${isShowAuthor ? 'mr-2 pr-1' : ''}`}>
                  <Link to={`/${sanitizeRule(item.item.fields.slug)}`}>
                    {item.item.frontmatter.title}
                  </Link>
                </div>
                {isShowAuthor && (
                  <div className="hidden lg:block">
                    <button
                      onClick={() => openUserRule(item.file.node.file)}
                      className="text-left cursor-pointer hover:text-ssw-red"
                    >
                      {item.file.node.createdBy
                        .replace('[SSW]', '')
                        .replace(/([a-z])([A-Z])/g, '$1 $2')}
                    </button>
                  </div>
                )}
                <FormatDate item={item} />
              </div>
            );
          })
        ) : (
          <div className="py-2">No Results...</div>
        )}
      </Heading>
    </section>
  );
};

export default LatestRulesContent;

LatestRulesContent.propTypes = {
  filteredItems: object,
  title: string,
  notFound: bool,
  isAscending: bool,
  setIsAscending: func,
  item: objectOf(Object),
  isShowAuthor: bool,
};
