import React, { useRef, useState, useEffect } from 'react';
import { graphql } from 'gatsby';
import PropTypes from 'prop-types';
import { config } from '@fortawesome/fontawesome-svg-core';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import RadioButton from '../components/radio-button/radio-button';
import { Link } from 'gatsby';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import {
  faArrowCircleRight,
  faPencilAlt,
  faExclamationTriangle,
  faQuoteLeft,
  faFileLines,
  faBook,
} from '@fortawesome/free-solid-svg-icons';
import Bookmark from '../components/bookmark/bookmark';
import { pathPrefix } from '../../site-config';

config.autoAddCss = false;

const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  },
});

appInsights.loadAppInsights();

const Orphaned = ({ data }) => {
  const linkRef = useRef();

  const [selectedOption, setSelectedOption] = useState('all');
  const [showViewButton, setShowViewButton] = useState(false);

  useEffect(() => {
    setShowViewButton(true);
  }, []);

  const handleOptionChange = (e) => {
    setSelectedOption(e.target.value);
  };

  const rules = data.rules.nodes;

  return (
    <div>
      <Breadcrumb categoryTitle="Orphaned" isCategory={true} />
      <div className="w-full">
        <div className="rule-category rounded">
          <section className="mb-20 rounded pb-2">
            <div className="cat-title-grid-container">
              <h1 className="text-ssw-black font-medium text-3xl">
                Orphaned Rules
                <span className="rule-count">
                  {' - '} {rules.length} {rules.length > 1 ? 'Rules' : 'Rule'}
                </span>
              </h1>
            </div>

            <div className="rule-category-top py-4 px-6 pt-5">
              <div>
                <br />
                <div className="attention archived px-4">
                  <FontAwesomeIcon
                    icon={faExclamationTriangle}
                    className="attentionIcon"
                  />{' '}
                  The rules listed below have no parent category
                </div>
              </div>
            </div>
            {showViewButton && (
              <div className="border-b border-solid border-b-gray-100 grid grid-cols-1 gap-5 p-4 text-center lg:grid-cols-5">
                <div></div>
                <RadioButton
                  id="customRadioInline1"
                  name="customRadioInline1"
                  value="titleOnly"
                  selectedOption={selectedOption}
                  handleOptionChange={handleOptionChange}
                  labelText="View titles only"
                  icon={faQuoteLeft}
                />
                <RadioButton
                  id="customRadioInline3"
                  name="customRadioInline1"
                  value="blurb"
                  selectedOption={selectedOption}
                  handleOptionChange={handleOptionChange}
                  labelText="Show blurb"
                  icon={faFileLines}
                />
                <RadioButton
                  id="customRadioInline2"
                  name="customRadioInline1"
                  value="all"
                  selectedOption={selectedOption}
                  handleOptionChange={handleOptionChange}
                  labelText="Gimme everything!"
                  icon={faBook}
                />
              </div>
            )}
            <div className="category-rule">
              <ol className="rule-number">
                {rules.map((rule, i) => {
                  if (!rule) {
                    return;
                  }
                  return (
                    <div key={i}>
                      <li key={i}>
                        <section className="rule-content-title pl-2">
                          <div className="rule-header-container justify-between align-middle">
                            <h2 className="flex flex-col justify-center">
                              <Link
                                ref={linkRef}
                                to={`/${rule.frontmatter.uri}`}
                              >
                                {rule.frontmatter.title}
                              </Link>
                            </h2>
                            <div className="rule-buttons category flex flex-col sm:flex-row">
                              <Bookmark
                                ruleId={rule.frontmatter.guid}
                                className="category-bookmark"
                              />
                              <button className="tooltip">
                                <a
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  href={`${pathPrefix}/admin/#/collections/rule/entries/${rule.frontmatter.uri}/rule`}
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
                                    className="bookmark-icon"
                                  />
                                </a>
                                <span className="tooltiptext w-52 !-left-[4.6rem]">
                                  Edit
                                  <p>
                                    (Warning: Stale branches can cause issues -
                                    See wiki for help)
                                  </p>
                                </span>
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
                                    className="bookmark-icon"
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
                          <div
                            dangerouslySetInnerHTML={{ __html: rule.html }}
                          />
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
};
Orphaned.propTypes = {
  data: PropTypes.object.isRequired,
  pageContext: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
};

export default Orphaned;

export const query = graphql`
  query ($index: [String]!) {
    rules: allMarkdownRemark(filter: { frontmatter: { uri: { in: $index } } }) {
      nodes {
        frontmatter {
          uri
          archivedreason
          title
        }
        html
        excerpt(format: HTML, pruneLength: 500)
      }
    }
  }
`;
