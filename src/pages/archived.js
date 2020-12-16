import React, { useRef } from 'react';
import { StaticQuery, graphql } from 'gatsby';
import PropTypes from 'prop-types';
import { config } from '@fortawesome/fontawesome-svg-core';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import SideBar from '../components/side-bar/side-bar';
import { Link } from 'gatsby';
import TopCategoryHeader from '../components/topcategory-header/topcategory-header';

config.autoAddCss = false;

const Archived = ({ data }) => {
  var archivedRules = data.rules.nodes.filter(
    (r) => r.frontmatter.archivedreason
  );

  var categoriesWithArchive = data.categories.nodes.filter((c) =>
    archivedRules.find((r) => c.frontmatter.index.includes(r.frontmatter.uri))
  );
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

  const getNumberOfRulesForCat = (categories) => {
    return categories.frontmatter.index.filter((c) =>
      archivedRules.find((r) => c == r.frontmatter.uri)
    ).length;
  };

  const displayTopCategories = (topcategory) => {
    return (
      <>
        <section className="mb-5 relative">
          <TopCategoryHeader
            topCategory={topcategory}
            categories={categoriesWithArchive}
            archivedRules={archivedRules}
          >
            {topcategory.frontmatter.index.map((category, i) => {
              const cat = findCategoryFromIndexValue(category);
              if (cat) {
                return (
                  <li key={i}>
                    {cat.frontmatter.title}
                    <span className="d-none d-md-block">
                      ({getNumberOfRulesForCat(cat)})
                    </span>
                    <ul className="pt-2 px-4 py-2">
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
                    </ul>
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
      <Breadcrumb isArchived={true} />
      <div className="container" id="rules">
        <div className="flex">
          <div className="w-3/4 px-4">
            <div className="category attentionIcon archived mt-2 mb-5">
              The rules listed below are archived
            </div>
            <div className="rule-index archive no-gutters rounded">
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

          <div className="w-1/4 px-4" id="sidebar">
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

const ArchivedWithQuery = (props) => (
  <StaticQuery
    query={graphql`
      query ArchiveQuery {
        main: allMarkdownRemark(
          filter: {
            fileAbsolutePath: { regex: "/(categories)/" }
            frontmatter: { type: { eq: "main" } }
          }
        ) {
          nodes {
            html
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
        topCategories: allMarkdownRemark(
          filter: {
            fileAbsolutePath: { regex: "/(categories)/" }
            frontmatter: { type: { eq: "top-category" } }
          }
        ) {
          nodes {
            html
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
        categories: allMarkdownRemark(
          filter: {
            fileAbsolutePath: { regex: "/(categories)/" }
            frontmatter: { type: { eq: "category" } }
          }
        ) {
          nodes {
            html
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
        rules: allMarkdownRemark(
          filter: { frontmatter: { type: { eq: "rule" } } }
        ) {
          nodes {
            frontmatter {
              uri
              archivedreason
              title
            }
          }
        }
      }
    `}
    render={(data) => <Archived data={data} {...props} />}
  />
);

export default ArchivedWithQuery;
