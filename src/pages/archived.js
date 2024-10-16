import { config } from '@fortawesome/fontawesome-svg-core';
import {
  faArchive,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { graphql, Link, useStaticQuery } from 'gatsby';
import PropTypes from 'prop-types';
import React, { useRef } from 'react';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import SideBar from '../components/side-bar/side-bar';
import TopCategoryHeader from '../components/topcategory-header/topcategory-header';

config.autoAddCss = false;

const Archived = ({ data }) => {
  var archivedRules = data.rules.nodes.filter(
    (r) => r.frontmatter.archivedreason
  );

  var categoriesWithArchive = data.categories.nodes.filter((c) =>
    archivedRules.find((r) => c.frontmatter.index.includes(r.frontmatter.uri))
  );

  let archivedCategories = data.categories.nodes.filter(
    (c) => c.frontmatter.archivedreason
  );

  categoriesWithArchive = [...categoriesWithArchive, ...archivedCategories];

  var topCategoriesWithArchive = data.topCategories.nodes.filter((t) =>
    categoriesWithArchive.find((c) =>
      t.frontmatter.index.includes(c.parent.name.toLowerCase())
    )
  );

  const linkRef = useRef();

  const findCategoryFromIndexValue = (categoryFromIndex) => {
    return categoriesWithArchive.find(
      (c) =>
        c.parent.name.toLowerCase() === `${categoryFromIndex.toLowerCase()}`
    );
  };

  /**
   * Get the total number of archived/unarchived rules
   * @param {Object} categories The category to search a rule for
   * @param {boolean} [archived=true] Whether to get the total count of archived vs unarchived rules
   * @return {number} The total rule count
   */
  const getNumberOfRulesForCat = (categories, archived = true) => {
    return categories.frontmatter.index.filter((c) =>
      archivedRules.find((r) =>
        archived ? c == r.frontmatter.uri : c != r.frontmatter.uri
      )
    ).length;
  };

  const displayTopCategories = (topcategory) => {
    return (
      <>
        <section className="mb-5 relative">
          <TopCategoryHeader
            topCategory={topcategory}
            categories={categoriesWithArchive}
            rules={archivedRules}
          >
            {topcategory.frontmatter.index.map((category, i) => {
              const cat = findCategoryFromIndexValue(category);
              if (cat) {
                return (
                  <li key={i}>
                    <strong>
                      <Link ref={linkRef} to={`/${cat.parent.name}`}>
                        {' '}
                        {cat.frontmatter.title}
                      </Link>
                    </strong>

                    {cat.frontmatter.archivedreason && (
                      <FontAwesomeIcon
                        className="ml-2"
                        icon={faArchive}
                        title="Archived Category"
                      />
                    )}
                    <span className="d-none d-md-block">
                      {getNumberOfRulesForCat(cat)}
                    </span>
                    <ol className="pt-2 px-4 py-2">
                      {archivedRules
                        .filter((r) =>
                          cat.frontmatter.index.includes(r.frontmatter.uri)
                        )
                        .map((r, i) => {
                          return (
                            <li key={i}>
                              <Link
                                ref={linkRef}
                                to={`/${r.frontmatter.uri}`}
                                state={{ category: cat.parent.name }}
                              >
                                {r.frontmatter.title}
                              </Link>
                            </li>
                          );
                        })}
                    </ol>
                  </li>
                );
              }
            })}
          </TopCategoryHeader>
        </section>
      </>
    );
  };

  return (
    <div className="w-full">
      <Breadcrumb breadcrumbText="Archived" />
      <div className="container" id="rules">
        <div className="flex flex-wrap">
          <div className="w-full lg:w-3/4 px-4">
            <div className="category attention archived px-4 mt-2 mb-5">
              <FontAwesomeIcon
                icon={faExclamationTriangle}
                className="attentionIcon"
              />{' '}
              The rules listed below have been archived
            </div>
            <div className="rule-index archive no-gutters rounded mb-12">
              {data.main.nodes.map((element) => {
                return element.frontmatter.index.map((category) => {
                  const cat = topCategoriesWithArchive.find(
                    (c) =>
                      c.parent.relativeDirectory.toLowerCase() ===
                      `categories/${category.toLowerCase()}`
                  );
                  if (cat) {
                    return displayTopCategories(cat);
                  }
                });
              })}
            </div>
          </div>

          <div className="w-full lg:w-1/4 px-4" id="sidebar">
            <SideBar ruleTotalNumber={data.rules.nodes.length} />
          </div>
        </div>
      </div>
    </div>
  );
};
Archived.propTypes = {
  data: PropTypes.object.isRequired,
  search: PropTypes.object.isRequired,
  pageContext: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
};

function ArchivedWithQuery(props) {
  const data = useStaticQuery(graphql`
    query ArchiveQuery {
      main: allMdx(filter: { frontmatter: { type: { eq: "main" } } }) {
        nodes {
          frontmatter {
            type
            title
            index
          }
          parent {
            ... on File {
              name
            }
          }
        }
      }
      topCategories: allMdx(
        filter: { frontmatter: { type: { eq: "top-category" } } }
      ) {
        nodes {
          frontmatter {
            type
            title
            index
          }
          parent {
            ... on File {
              name
              relativeDirectory
            }
          }
        }
      }
      categories: allMdx(
        filter: { frontmatter: { type: { eq: "category" } } }
      ) {
        nodes {
          frontmatter {
            type
            title
            archivedreason
            index
          }
          parent {
            ... on File {
              name
              relativeDirectory
            }
          }
        }
      }
      rules: allMdx(filter: { frontmatter: { type: { eq: "rule" } } }) {
        nodes {
          frontmatter {
            uri
            archivedreason
            title
          }
        }
      }
    }
  `);

  return <Archived data={data} {...props} />;
}

export default ArchivedWithQuery;
