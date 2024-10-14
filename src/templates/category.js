import GreyBox from '../components/greybox/greybox';

import { faGithub } from '@fortawesome/free-brands-svg-icons';
import {
  faArrowCircleRight,
  faBook,
  faFileLines,
  faPencilAlt,
  faQuoteLeft,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { graphql, Link } from 'gatsby';
import PropTypes from 'prop-types';
import React, { useEffect, useRef, useState } from 'react';
import { TinaMarkdown } from 'tinacms/dist/rich-text';
import { pathPrefix } from '../../site-config';
import Bookmark from '../components/bookmark/bookmark';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import RadioButton from '../components/radio-button/radio-button';
import Tooltip from '../components/tooltip/tooltip';
const components = {
  greyBox: GreyBox,
};

const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  },
});

appInsights.loadAppInsights();

export default function Category({ data, pageContext }) {
  console.log('data', data);
  console.log('pageContext', pageContext);

  const linkRef = useRef();
  const category = data.mdx;

  const [selectedOption, setSelectedOption] = useState('all');
  const [showViewButton, setShowViewButton] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    setShowViewButton(true);
    setLocalOption();
  }, []);

  const setLocalOption = () => {
    if (typeof window !== 'undefined') {
      const viewModeOption = sessionStorage.getItem('viewModeOption') || 'all';
      setSelectedOption(viewModeOption);
    }
  };

  const handleOptionChange = (e) => {
    setSelectedOption(e.target.value);
    sessionStorage.setItem('viewModeOption', e.target.value);
  };

  const handleIncludeArchivedChange = () => {
    setIncludeArchived(!includeArchived);
  };

  var rules = pageContext.rules.nodes
    .filter((r) => {
      return includeArchived || !r.frontmatter.archivedreason;
    })
    .filter((r) => {
      return category.frontmatter.index.includes(r.frontmatter.uri);
    });

  return (
    <div>
      <Breadcrumb
        categoryTitle={category.frontmatter.title}
        isCategory={true}
        categories={
          category.frontmatter.archivedreason && [
            { link: '/archived', title: 'Archived' },
          ]
        }
      />
      <div className="w-full">
        <div className="rule-category rounded">
          <section className="mb-20 rounded pb-2">
            <div className="cat-title-grid-container">
              <h1 className="font-semibold">
                {category.frontmatter.title}
                <span className="rule-count">
                  {' - '} {rules.length} {rules.length > 1 ? 'Rules' : 'Rule'}
                </span>
              </h1>

              <Tooltip text="Edit in GitHub" className="mt-1 justify-self-end">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://github.com/SSWConsulting/SSW.Rules.Content/tree/${process.env.CONTENT_BRANCH}/${category.parent.relativePath}`}
                >
                  <FontAwesomeIcon
                    icon={faGithub}
                    size="2x"
                    className="category-icon bookmark-icon"
                  />
                </a>
              </Tooltip>
            </div>

            <div className="rule-category-top py-4 px-6 pt-5">
              <TinaMarkdown content={pageContext.intro}></TinaMarkdown>
              {/* <MD components={components} htmlAst={category.htmlAst} /> */}

              {category.frontmatter.archivedreason &&
                category.frontmatter.archivedreason.length > 0 && (
                  <div>
                    <br />
                    <div className="attention archived px-4">
                      <FontAwesomeIcon
                        icon={faExclamationTriangle}
                        className="attentionIcon"
                      />{' '}
                      This category has been archived
                    </div>
                    <div className="RuleArchivedReasonContainer px-4">
                      <span className="ReasonTitle">Archived Reason: </span>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: markdownIt().renderInline(
                            category.frontmatter.archivedreason
                          ),
                        }}
                      ></span>
                    </div>
                  </div>
                )}
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
                <div className="rule-category-checkbox">
                  <label className="rule-category-checkbox-label">
                    <input
                      type="checkbox"
                      checked={includeArchived}
                      onChange={handleIncludeArchivedChange}
                      className="h-5 w-5 accent-ssw-red"
                    />
                    <span className="ml-2">Include Archived</span>
                  </label>
                </div>
              </div>
            )}

            <div className="category-rule p-0 sm:p-[2.2rem]">
              <ol className="rule-number list-none sm:list-decimal">
                {category.frontmatter.index.map((r, i) => {
                  var rule = rules.find((rr) => rr.frontmatter.uri == r);
                  if (!rule) {
                    return;
                  }
                  return (
                    <div key={i} className="mb-3">
                      <li key={i}>
                        <section className="rule-content-title sm:pl-2">
                          <div className="rule-header-container justify-between align-middle">
                            <h2 className="flex flex-col justify-center">
                              <Link
                                ref={linkRef}
                                to={`/${rule.frontmatter.uri}`}
                                state={{ category: category.parent.name }}
                              >
                                {rule.frontmatter.title}
                                {rule.frontmatter.archivedreason && (
                                  <span className="rule-category-archived-badge ml-2">
                                    Archived
                                  </span>
                                )}
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
                          <TinaMarkdown content={rule.body} />
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
        {(category.frontmatter.consulting || category.frontmatter.experts) && (
          <div className="flex flex-col items-center justify-center gap-4 -mt-16 mb-10">
            <h3 className="text-3xl">
              Need some help with{' '}
              <span className="text-ssw-red">
                {category.frontmatter.title
                  .replace(/Rules to(?: Better)?/, '')
                  .trim()}
              </span>
              ?
            </h3>

            {category.frontmatter.consulting && (
              <button
                className="bg-ssw-red text-white px-5 py-3 text-lg"
                onClick={() =>
                  window.open(category.frontmatter.consulting, '_blank')
                }
              >
                See our consulting services
              </button>
            )}

            {category.frontmatter.experts && (
              <Link
                to={category.frontmatter.experts}
                className="group unstyled"
              >
                <span className="text-lg font-medium underline decoration-underline duration-150 group-hover:decoration-ssw-red group-hover:text-ssw-red transition ease-in-out delay-75">
                  Meet our experts
                </span>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

Category.propTypes = {
  data: PropTypes.object.isRequired,
  pageContext: PropTypes.object.isRequired,
};

export const query = graphql`
  query ($slug: String!, $index: [String!]) {
    mdx(fields: { slug: { eq: $slug } }) {
      frontmatter {
        title
        archivedreason
        index
        uri
        guid
        consulting
        experts
      }
      parent {
        ... on File {
          relativePath
          name
        }
      }
    }
    rule: allMdx(filter: { frontmatter: { uri: { in: $index } } }) {
      nodes {
        frontmatter {
          uri
          archivedreason
          title
          guid
          consulting
          experts
        }
      }
    }
  }
`;
