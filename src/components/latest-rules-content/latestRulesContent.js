import { bool, func, object, objectOf, string } from 'prop-types';

import { FilterOptions } from '../filter/filter';
import Heading from '../heading/heading';
import { Link } from 'gatsby';
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
    <span className="block all-rules-time">
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

  return (
    <section className="mb-5 relative">
      <Heading
        title={title}
        isAscending={isAscending}
        setIsAscending={setIsAscending}
      >
        {!notFound ? (
          filteredItems.list.map((item, idx) => {
            return (
              <div key={idx} className="cat-grid-container">
                <div className="cat-rule-num">{idx + 1}.</div>
                <div className="text-left">
                  <Link to={`/${sanitizeRule(item.item.fields.slug)}`}>
                    {item.item.frontmatter.title}
                  </Link>
                </div>
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
};
