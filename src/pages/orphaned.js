import React, { useRef, useState } from 'react';
import { StaticQuery, graphql } from 'gatsby';
import PropTypes from 'prop-types';
import { config } from '@fortawesome/fontawesome-svg-core';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import SideBar from '../components/side-bar/side-bar';
import { Link } from 'gatsby';
import TopCategoryHeader from '../components/topcategory-header/topcategory-header';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArchive } from '@fortawesome/free-solid-svg-icons';

import {
  faFacebook,
  faGithub,
  faInstagram,
  faLinkedin,
  faTwitter,
  faWeixin,
  faYoutube,
} from '@fortawesome/free-brands-svg-icons';
import {
  faArrowCircleRight,
  faPencilAlt,
} from '@fortawesome/free-solid-svg-icons';
import MD from 'gatsby-custom-md';
import GreyBox from '../components/greybox/greybox';
import Bookmark from '../components/bookmark/bookmark';

config.autoAddCss = false;

const Orphaned = ({ data }) => {
  const linkRef = useRef();

  const [selectedOption, setSelectedOption] = useState('all');

  const handleOptionChange = (e) => {
    setSelectedOption(e.target.value);
  };

  const components = {
    greyBox: GreyBox,
  };
  
  /**
    * Get all rules that don't have an associated category
    * @param {Object} rules All rule nodes
    * @param {Object} categories All category nodes
    * @return {array} All rules without an associated category 
  */
  const findOrphanedRules = (rules, categories) => {
      const orphanedRules = [];

      rules.nodes.forEach((node) => {
        // Find any rules missing a category
        var match = false;
        if (!node.frontmatter.archivedreason) {
          categories.nodes.forEach((catNode) => {
            catNode.frontmatter.index.forEach((inCat) => {
              if (node.frontmatter.uri == inCat) {
                match = true;
              }
            });
          });
        } else {
          match = true;
        }
        if (match == false) {
          orphanedRules.push(node)
      }})

      return orphanedRules;
  }

  const category = data.categories.nodes[0]
  const rules = findOrphanedRules(data.rules, data.categories); 

  return (
    <div>
      <Breadcrumb 
        categoryTitle="Orphaned"
        isCategory={true}
      />
      <div className="w-full">
        <div className="rule-category rounded">
          <section className="mb-20 pb-2 rounded">
            <div className="cat-title-grid-container">
              <h2 className="cat-title">
                Orphaned Rules
                <span className="rule-count">
                  {' - '} {rules.length} {rules.length > 1 ? 'Rules' : 'Rule'}
                </span>
              </h2>
              <button className="tooltip justify-self-end mt-1">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://github.com/SSWConsulting/SSW.Rules.Content/tree/${process.env.CONTENT_BRANCH}/${category.parent.relativePath}`}
                  className="tooltip tooltip-button"
                >
                  <FontAwesomeIcon
                    icon={faGithub}
                    size="2x"
                    className="category-icon bookmark-icon"
                  />
                </a>
                <span className="category-tooltip tooltiptext">
                  Edit in GitHub
                </span>
              </button>
            </div>

            <div className="rule-category-top pt-5 py-4 px-6">
              <div>
                <br />
                <div className="attention archived px-4">
                  <FontAwesomeIcon
                    icon={faExclamationTriangle}
                    className="attentionIcon"
                  />{' '}
                    These rules have no parent category
                </div>
                <div className="RuleArchivedReasonContainer px-4">
                  <span className="ReasonTitle">All rules displayed below have no parent categories. </span>
                </div>
              </div>

            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 radio-toolbar how-to-view text-center p-4 d-print-none">
              <div></div>
              <div>
                <input
                  type="radio"
                  id="customRadioInline1"
                  name="customRadioInline1"
                  className="custom-control-input"
                  value="titleOnly"
                  checked={selectedOption === 'titleOnly'}
                  onChange={handleOptionChange}
                />
                <label
                  className="view-title custom-control-label ml-1"
                  htmlFor="customRadioInline1"
                >
                  View titles only
                </label>
              </div>
              <div>
                <input
                  type="radio"
                  id="customRadioInline3"
                  name="customRadioInline1"
                  className="custom-control-input"
                  value="blurb"
                  checked={selectedOption === 'blurb'}
                  onChange={handleOptionChange}
                />
                <label
                  className="view-blurb custom-control-label ml-1"
                  htmlFor="customRadioInline3"
                >
                  Show Blurb
                </label>
              </div>
              <div>
                <input
                  type="radio"
                  id="customRadioInline2"
                  name="customRadioInline1"
                  className="custom-control-input"
                  value="all"
                  checked={selectedOption === 'all'}
                  onChange={handleOptionChange}
                />
                <label
                  className="view-full custom-control-label ml-1"
                  htmlFor="customRadioInline2"
                >
                  Gimme everything!
                </label>
              </div>
            </div>
            <div className="category-rule">
              <ol className="rule-number">
                {rules.map((rule, i) => {
                    console.log(rule)
                  if (!rule) {
                    return;
                  }
                  return (
                    <div key={i}>
                      <li key={i}>
                        <section className="rule-content-title pl-2">
                          <div className="rule-header-container align-middle justify-between">
                            <h2 className="flex flex-col justify-center">
                              <Link
                                ref={linkRef}
                                to={`/${rule.frontmatter.uri}`}
                              >
                                {rule.frontmatter.title}
                              </Link>
                            </h2>
                            <div className="rule-buttons flex flex-col sm:flex-row category">
                              <Bookmark
                                ruleId={rule.frontmatter.guid}
                                className="category-bookmark"
                              />
                              <button className="tooltip">
                                <a
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  href={`/rules/admin/#/collections/rule/entries/${rule.frontmatter.uri}/rule`}
                                  className="tooltip tooltip-button"
                                  onClick={() => {
                                    appInsights.trackEvent({
                                      name: 'EditMode-NetlifyCMS',
                                    });
                                  }}
                                >
                                  <FontAwesomeIcon
                                    icon={faPencilAlt}
                                    size="lg"
                                    className="text-ssw-red bookmark-icon"
                                  />
                                </a>
                                <span className="tooltiptext">Edit</span>
                              </button>
                              <button className="tooltip">
                                <a
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  href={`https://github.com/SSWConsulting/SSW.Rules.Content/tree/${process.env.CONTENT_BRANCH}/rules/${rule.frontmatter.uri}/rule.md`}
                                  className="tooltip tooltip-button"
                                  onClick={() => {
                                    appInsights.trackEvent({
                                      name: 'EditMode-GitHub',
                                    });
                                  }}
                                >
                                  <FontAwesomeIcon
                                    icon={faGithub}
                                    size="lg"
                                    className="text-ssw-red bookmark-icon"
                                  />
                                </a>
                                <span className="tooltiptext">
                                  Edit in GitHub
                                </span>
                              </button>
                            </div>
                          </div>
                        </section>

                        <section
                          className={`rule-content mb-4
                            ${selectedOption === 'all' ? 'visible' : 'hidden'}`}
                        >
                        {/*<MD components={components} htmlAst={rule.htmlAst} />*/}
                                                </section>

                        <section
                          className={`rule-content mb-4
                          ${selectedOption === 'blurb' ? 'visible' : 'hidden'}`}
                        >
                          <div
                            dangerouslySetInnerHTML={{ __html: rule.excerpt }}
                          />
                          <p className="pt-5 pb-0 font-bold">
                            <Link
                              ref={linkRef}
                              to={`/${rule.frontmatter.uri}`}
                              state={{ category: category.parent.name }}
                              title={`Read more about ${rule.frontmatter.title}`}
                            >
                              <FontAwesomeIcon icon={faArrowCircleRight} /> Read
                              more
                            </Link>
                          </p>
                        </section>
                      </li>
                    </div>
                  );
                })}
              </ol>
            </div>
          </section>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <Breadcrumb isArchived={true} />
      <div className="container" id="rules">
        <div className="flex flex-wrap">
          <div className="w-full lg:w-3/4 px-4">
            <div className="rule-index archive no-gutters rounded mb-12">
                <ol className="pt-2 px-4 py-2">
                  {findOrphanedRules(data.rules, data.categories)
                    .map((r, i) => {
                      return (
                        <li key={i}>
                          <Link
                            ref={linkRef}
                            to={`/${r.frontmatter.uri}`}
                          >
                            {r.frontmatter.title}
                          </Link>
                        </li>
                      );
                    })}
                </ol>
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
Orphaned.propTypes = {
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
        rules: allMarkdownRemark(
          filter: { frontmatter: { type: { eq: "rule" } } }
        ) {
          nodes {
            frontmatter {
              uri
              archivedreason
              title
            }
            htmlAst
            excerpt
          }
        }
      }
    `}
    render={(data) => <Orphaned data={data} {...props} />}
  />
);

export default ArchivedWithQuery;
