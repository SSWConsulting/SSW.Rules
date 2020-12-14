import React from 'react';
import { StaticQuery, graphql } from 'gatsby';
import PropTypes from 'prop-types';
import { config } from '@fortawesome/fontawesome-svg-core';
import { faArchive, faFlag } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import TopCategory from '../components/top-category/top-category';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import Sidebar from '../components/sidebar/sidebar';

config.autoAddCss = false;

const Index = ({ data }) => {
  const displayTopCategories = (topcategory) => {
    return (
      <>
        <section className="mb-5 relative">
          <TopCategory
            topcategory={topcategory}
            categories={data.categories}
          ></TopCategory>
        </section>
      </>
    );
  };

  return (
    <div className="w-full lg:w-3/">
      <Breadcrumb isHomePage={true} />
      <div className="container" id="rules">
        <div className="flex flex-wrap">
          <div className="w-4/4 lg:w-3/4 px-4">
            <div className="rule-index no-gutters rounded">
              {data.main.nodes.map((element) => {
                return element.frontmatter.index.map((category) => {
                  const cat = data.topCategories.nodes.find(
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
            <section className="pb-8">
              <p>
                <a href="/archived">
                  <FontAwesomeIcon icon={faArchive} /> Show archived rules
                </a>
              </p>
              <p>
                <a href="/out-of-dates">
                  <FontAwesomeIcon icon={faFlag} /> Show rules flagged as out of
                  date
                </a>
              </p>
            </section>
          </div>
          <Sidebar data={data.rules.nodes.length} />
        </div>
      </div>
    </div>
  );
};
Index.propTypes = {
  data: PropTypes.object.isRequired,
  search: PropTypes.object.isRequired,
  pageContext: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
};

const IndexWithQuery = (props) => (
  <StaticQuery
    query={graphql`
      query HomepageQuery {
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
              title
            }
          }
        }
      }
    `}
    render={(data) => <Index data={data} {...props} />}
  />
);

export default IndexWithQuery;
