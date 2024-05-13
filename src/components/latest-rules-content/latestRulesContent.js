import { bool, func, object, objectOf, string } from 'prop-types';

import { FilterOptions } from '../filter/filter';
import Heading from '../heading/heading';
import { Link, navigate } from 'gatsby';
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import locale from 'date-fns/locale/en-AU';
import { sanitizeName } from '../../helpers/sanitizeName';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock } from '@fortawesome/free-solid-svg-icons';

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
      return `${result}s ago`;
    }

    return result + ' ago';
  };

  const FormatDate = ({ item }) => (
    <span className="block text-light-grey text-right">
      <FontAwesomeIcon icon={faClock} size="sm" className="mr-1" />

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

  const openUserRule = async (path, state) => {
    const loginName = await fetchGithubName(path, state);
    navigate(`/user/?author=${loginName}`);
  };

  const fetchGithubName = async (path, state) => {
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
    const loginName =
      state === 0
        ? data[data.length - 1]?.author?.login
        : data[0]?.author?.login; //When we're finding user's github who creates the rule, state = 0,  otherwise state = 1.
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
                  isShowAuthor
                    ? 'lg:grid-cols-[2rem_auto_9.5rem_9.5rem_7.5rem]'
                    : 'sm:grid-cols-[2rem_auto_auto]'
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
                      onClick={() => openUserRule(item.file.node.file, 1)}
                      className="text-left cursor-pointer hover:text-ssw-red"
                    >
                      {item.file.node.lastUpdatedBy
                        ? item.file.node.lastUpdatedBy
                            .replace('[SSW]', '')
                            .replace(/([a-z])([A-Z])/g, '$1 $2')
                        : item.file.node.createdBy
                            .replace('[SSW]', '')
                            .replace(/([a-z])([A-Z])/g, '$1 $2')}
                    </button>
                  </div>
                )}
                {isShowAuthor && (
                  <div className="hidden lg:block">
                    <button
                      onClick={() => openUserRule(item.file.node.file, 0)}
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
