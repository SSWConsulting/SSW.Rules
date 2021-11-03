import Filter, { FilterOptions } from '../components/filter';
import React, { useEffect, useState } from 'react';
import {
  faSortAmountDown,
  faSortAmountUp,
} from '@fortawesome/free-solid-svg-icons';

import Breadcrumb from '../components/breadcrumb/breadcrumb';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'gatsby';
import SideBar from '../components/side-bar/side-bar';
import { formatDistanceToNow } from 'date-fns';
import { graphql } from 'gatsby';
import locale from 'date-fns/locale/en-AU';
import queryString from 'query-string';

const AllRules = ({ data }) => {
  const [filter, setFilter] = useState();
  const [history, setHistory] = useState(data.allHistoryJson.edges);
  const [rules, setRules] = useState(data.allMarkdownRemark.nodes);
  const [notFound, setNotFound] = useState(false);
  const [filterTitle, setFilterTitle] = useState('Results');
  const [filtereditems, setFilteredItems] = useState({ list: [], filter: {} });
  const [isAscending, setIsAscending] = useState(true);

  const qs = queryString.parse(location.search, { parseNumbers: true });
  const qsSize = qs.size ? (qs.size > 100 ? 100 : qs.size) : 10;

  useEffect(() => {
    filterBySort(filter);
  }, [filter, isAscending]);

  const filterBySort = (_filter) => {
    if (!_filter || _filter?.length === 0) {
      return;
    }
    let timeSelect = new Date();

    setFilteredItems({});
    let count = 0;
    const foundRules = rules.map((item) => {
      //Todo(Jack): Depending on the speed - optimise this find
      let findRule = history.find(
        (r) => sanitizeName(r) === sanitizeName(item.fields.slug, true)
      );

      //Return if a rule isn't found in history.json or if its archived
      if (!findRule || item.frontmatter.archivedreason || count >= qsSize)
        return;

      count++;
      // console.log(timeSelect);
      return { item: item, file: findRule };
    });

    //Remove undefined
    const filteredRules = foundRules.filter((i) => i !== undefined);

    // setFilterTitle(`Sorted by ${_filter}`);

    if (filteredRules.length === 0) {
      setNotFound(true);
      return;
    } else {
      setNotFound(false);
    }
    console.log(FilterOptions);

    switch (_filter) {
      case FilterOptions.Dc:
        filteredRules.sort((a, b) => {
          if (a.file.node.created < b.file.node.created) return 1;
          if (a.file.node.created > b.file.node.created) return -1;
          return 0;
        });
        break;
      case FilterOptions.De:
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

    setFilteredItems({ list: filteredRules, filter: _filter });
    // console.log(foundRules);
  };

  const sanitizeName = (file, slug) => {
    const name = slug
      ? file.slice(1, file.length - 6)
      : file.node.file.slice(0, file.node.file.length - 8);
    return name;
  };

  return (
    <div className="w-full">
      <Breadcrumb title="All Rules" />

      <div className="container" id="rules">
        <div className="flex flex-wrap">
          <div className="w-full lg:w-3/4 px-4">
            <span className="flex">
              <h2 className="flex-1">All Rules</h2>
              <div className="flex items-center align-middle">
                <Filter selected={setFilter} />
              </div>
            </span>
            <div className="rule-index archive no-gutters rounded">
              <AllRulesContent
                filtereditems={filtereditems}
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

const Heading = ({ title, children, isAscending, setIsAscending }) => {
  return (
    <>
      <h6 className={'top-category-header px-4 py-2 flex rounded-t'}>
        <button
          onClick={() => setIsAscending(!isAscending)}
          className="w-full text-left"
        >
          {title}{' '}
          <span className="number">
            <p
              style={{
                textTransform: 'none',
                display: 'inline-block',
              }}
            ></p>
          </span>
          <span className="collapse-icon">
            <FontAwesomeIcon
              icon={isAscending ? faSortAmountUp : faSortAmountDown}
            />
          </span>
        </button>
      </h6>
      <ol className={'pt-3 px-4 py-2 block'}>{children}</ol>
    </>
  );
};

const AllRulesContent = ({
  filtereditems,
  title,
  notFound,
  isAscending,
  setIsAscending,
}) => {
  // console.log(filtereditems);
  const formatDistanceLocale = {
    lessThanXSeconds: '{{count}}s',
    xSeconds: '{{count}}s',
    halfAMinute: '30s',
    lessThanXMinutes: '{{count}}m',
    xMinutes: '{{count}}m',
    aboutXHours: '{{count}}h',
    xHours: '{{count}}h',
    xDays: '{{count}}d',
    aboutXWeeks: '{{count}}w',
    xWeeks: '{{count}}w',
    aboutXMonths: '{{count}}M',
    xMonths: '{{count}}M',
    aboutXYears: '{{count}}y',
    xYears: '{{count}}y',
    overXYears: '{{count}}y',
    almostXYears: '{{count}}y',
  };

  const formatDistance = (token, count, options) => {
    options = options || {};

    const result = formatDistanceLocale[token].replace('{{count}}', count);

    if (options.addSuffix) {
      if (options.comparison > 0) {
        return 'in ' + result;
      } else {
        return '> ' + result;
      }
    }

    return result;
  };

  return (
    <section className="mb-5 relative">
      <Heading
        title={title}
        isAscending={isAscending}
        setIsAscending={setIsAscending}
      >
        {!notFound ? (
          filtereditems.list.map((item, idx) => {
            return (
              <div key={idx} className="cat-grid-container">
                <div className="cat-rule-num">{idx + 1}.</div>
                <div className="cat-rule-link">
                  <Link to={`${item.item.fields.slug}`}>
                    {item.item.frontmatter.title}
                  </Link>
                </div>
                <span className="block">
                  {filtereditems.filter === FilterOptions.De
                    ? formatDistanceToNow(
                        new Date(item.file.node.lastUpdated),
                        {
                          locale: {
                            ...locale,
                            formatDistance,
                          },
                          addSuffix: true,
                        }
                      )
                    : formatDistanceToNow(new Date(item.file.node.created), {
                        locale: {
                          ...locale,
                          formatDistance,
                        },
                        addSuffix: true,
                      })}
                </span>
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
  }
`;

export default AllRules;
