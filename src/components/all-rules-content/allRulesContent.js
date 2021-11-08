import {
  faSortAmountDown,
  faSortAmountUp,
} from '@fortawesome/free-solid-svg-icons';

import { FilterOptions } from '../filter/filter';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Heading from '../heading/heading';
import { Link } from 'gatsby';
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import locale from 'date-fns/locale/en-AU';

const AllRulesContent = ({
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
      {filteredItems.filter === FilterOptions.DateEdited
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
                <div className="cat-rule-link">
                  <Link to={`${item.item.fields.slug}`}>
                    {item.item.frontmatter.title}
                  </Link>
                </div>
                <FormatDate item={item} />
              </div>
            );
          })
        ) : (
          <div>No Results...</div>
        )}
      </Heading>
    </section>
  );
};

export default AllRulesContent;
