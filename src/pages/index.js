import { Link, useStaticQuery, graphql } from 'gatsby';
import {
  faArchive,
  faPause,
  faBolt,
  faFrownOpen,
} from '@fortawesome/free-solid-svg-icons';

import Breadcrumb from '../components/breadcrumb/breadcrumb';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PropTypes from 'prop-types';
import React from 'react';
import SideBar from '../components/side-bar/side-bar';
import TopCategory from '../components/top-category/top-category';
import { config } from '@fortawesome/fontawesome-svg-core';
import SearchBar from '../components/search-bar/search-bar';

config.autoAddCss = false;

const Index = ({ data, location }) => {
  const notArchivedRules = data.rules.nodes.filter(
    (r) => !r.frontmatter.archivedreason
  );

  return (
    <div className="w-full">
      <Breadcrumb isHomePage={true} />
      <div className="container" id="rules">
        <div className="flex flex-wrap">
          <div className="w-full lg:w-3/4 px-4">
            <SearchBar toSearch />
            <span className="flex items-center">
              <h1 className="flex-1 text-3xl font-semibold text-ssw-red">
                Categories
              </h1>
              <Link to={'/latest-rules?size=50'} className="group unstyled">
                <FontAwesomeIcon
                  icon={faBolt}
                  size="lg"
                  className="group-hover:text-ssw-red transition ease-in-out delay-75 duration-150"
                />{' '}
                <span className="text-lg underline decoration-underline duration-150 group-hover:decoration-ssw-red group-hover:text-ssw-red transition ease-in-out delay-75">
                  Latest Rules
                </span>
              </Link>
            </span>
            <div className="rule-index no-gutters rounded mb-12">
              {data.main.nodes.map((element) => {
                return element.frontmatter.index.map((category, i) => {
                  const cat = data.topCategories.nodes.find(
                    (c) =>
                      c.parent.relativeDirectory.toLowerCase() ===
                      `categories/${category.toLowerCase()}`
                  );
                  if (cat) {
                    return (
                      <section className="mb-5 relative" key={i}>
                        <TopCategory
                          topcategory={cat}
                          categories={data.categories}
                          rules={notArchivedRules}
                        ></TopCategory>
                      </section>
                    );
                  }
                });
              })}
            </div>
            <section className="pb-8">
              <div className="grid grid-cols-2 md:grid-cols-4 justify-items-center md:justify-between text-center md:text-left">
                <Link
                  to={'/orphaned'}
                  className="flex-1 transition ease-in-out delay-75 hover:text-ssw-red duration-150 underline unstyled decoration-underline hover:decoration-ssw-red"
                >
                  <FontAwesomeIcon icon={faFrownOpen} className="mr-1" />
                  Orphaned Rules
                </Link>
                <Link
                  to={'/archived'}
                  className="mt-2 md:mt-0 transition ease-in-out delay-75 hover:text-ssw-red duration-150 underline decoration-underline hover:decoration-ssw-red unstyled"
                >
                  <FontAwesomeIcon icon={faArchive} className="mr-1" />
                  Archived Rules
                </Link>
                <a
                  href="https://www.ssw.com.au/ssw/Standards/Default.aspx"
                  className="mt-2 md:mt-0 transition ease-in-out delay-75 hover:text-ssw-red duration-150 underline decoration-underline hover:decoration-ssw-red unstyled"
                >
                  <FontAwesomeIcon icon={faPause} className="mr-1" />
                  Unmigrated Rules
                </a>
              </div>
            </section>
          </div>

          <div className="w-full lg:w-1/4 px-4" id="sidebar">
            <SideBar
              ruleTotalNumber={data.rules.nodes.length}
              location={location}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
Index.propTypes = {
  data: PropTypes.object.isRequired,
  pageContext: PropTypes.object.isRequired,
  location: PropTypes.object,
};

function IndexWithQuery(props) {
  const data = useStaticQuery(graphql`
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
            archivedreason
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
            uri
            archivedreason
          }
        }
      }
    }
  `);

  return <Index data={data} {...props} />;
}

export default IndexWithQuery;
