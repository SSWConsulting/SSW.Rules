import { graphql } from 'gatsby';
/* eslint-disable jsx-a11y/anchor-has-content */
import React from 'react';
import {
  faExclamationTriangle,
  faPencilAlt,
} from '@fortawesome/free-solid-svg-icons';
import { pathPrefix } from '../../site-config.js';
import markdownIt from 'markdown-it';
import Bookmark from '../components/bookmark/bookmark';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PropTypes from 'prop-types';
import RuleSideBar from '../components/rule-side-bar/rule-side-bar';
import formatDistance from 'date-fns/formatDistance';
import { format } from 'date-fns';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import useAppInsights from '../hooks/useAppInsights.js';
import Discussion from '../components/discussion/discussion.js';

const Rule = ({ data, location }) => {
  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };
  const rule = data.markdownRemark;
  const categories = data.categories.nodes;
  const { trackEvent } = useAppInsights();

  return (
    <div>
      <Breadcrumb
        isRule={true}
        title={rule.frontmatter.title}
        categories={
          rule.frontmatter.archivedreason
            ? [{ link: '/archived', title: 'Archived' }]
            : categories.map((category) => {
                return {
                  link: `/${category.parent.name}`,
                  title: category.frontmatter.title,
                };
              })
        }
      />
      <div className="container full-width m-auto" id="rules">
        <div className="flex flex-wrap">
          <div className={'w-full px-4 lg:w-3/4 md:w-1/1'}>
            <div className="rule-single rounded relative">
              <section className="rule-content mb-0">
                <div className="rule-header-container justify-between display:flex flex-col md:flex-row">
                  <div>
                    <h1 className="font-semibold">{rule.frontmatter.title}</h1>
                    {data.history && data.history.nodes[0] && (
                      <small className="history">
                        <span className="opacity-60">Last updated by</span>{' '}
                        <strong>
                          {capitalizeFirstLetter(
                            data.history.nodes[0].lastUpdatedBy
                          )}
                        </strong>{' '}
                        <span className="opacity-60 pr-1">
                          {formatDistance(
                            new Date(data.history.nodes[0].lastUpdated),
                            new Date()
                          )}{' '}
                          ago.
                        </span>
                        <a
                          title={`Created ${format(
                            new Date(data.history.nodes[0].created),
                            'dd MMM yyyy'
                          )}\nLast updated ${format(
                            new Date(data.history.nodes[0].lastUpdated),
                            'dd MMM yyyy'
                          )}`}
                          href={`https://github.com/SSWConsulting/SSW.Rules.Content/commits/${process.env.CONTENT_BRANCH}/rules/${rule.frontmatter.uri}/rule.md`}
                        >
                          See history
                        </a>
                      </small>
                    )}
                  </div>
                  <div className="rule-buttons flex flex-row justify-center mt-[1.35rem]">
                    <Bookmark ruleId={rule.frontmatter.guid} />
                    <button className="tooltip !mx-6 md:!mx-0">
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`${pathPrefix}/admin/#/collections/rule/entries/${rule.frontmatter.uri}/rule`}
                        className="tooltip tooltip-button"
                        onClick={() => {
                          trackEvent('EditMode-NetlifyCMS');
                        }}
                      >
                        <FontAwesomeIcon
                          icon={faPencilAlt}
                          size="2x"
                          className="bookmark-icon"
                        />
                      </a>
                      <span className="tooltiptext w-52 !-left-[4.6rem]">
                        Edit
                        <p>
                          (Warning: Stale branches can cause issues - See wiki
                          for help)
                        </p>
                      </span>
                    </button>
                    <button className="tooltip">
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://github.com/SSWConsulting/SSW.Rules.Content/tree/${process.env.CONTENT_BRANCH}/${rule.parent.relativePath}`}
                        className="tooltip tooltip-button"
                        onClick={() => {
                          trackEvent('EditMode-GitHub');
                        }}
                      >
                        <FontAwesomeIcon
                          icon={faGithub}
                          size="2x"
                          className="bookmark-icon"
                        />
                      </a>
                      <span className="tooltiptext">Edit in GitHub</span>
                    </button>
                  </div>
                </div>

                {rule.frontmatter.archivedreason &&
                  rule.frontmatter.archivedreason.length > 0 && (
                    <div>
                      <br />
                      <div className="attention archived px-4">
                        <FontAwesomeIcon
                          icon={faExclamationTriangle}
                          className="attentionIcon"
                        />{' '}
                        This rule has been archived
                      </div>
                      <div className="RuleArchivedReasonContainer px-4">
                        <span className="ReasonTitle">Archived Reason: </span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: markdownIt().renderInline(
                              rule.frontmatter.archivedreason
                            ),
                          }}
                        ></span>
                      </div>
                    </div>
                  )}
                <hr />
                <div dangerouslySetInnerHTML={{ __html: rule.html }} />
              </section>

              <div className="lg:hidden md:w-1/1 px-4">
                <RuleSideBar
                  categories={categories}
                  location={location}
                  rule={rule}
                  relatedRules={data.relatedRules}
                  relatedRulesFromRedirects={data.relatedRulesFromRedirects}
                />
              </div>

              <hr />

              <Discussion ruleGuid={rule.frontmatter.guid} />
            </div>
          </div>

          <div className="hidden lg:w-1/4 lg:block md:hidden">
            <RuleSideBar
              categories={categories}
              location={location}
              rule={rule}
              relatedRules={data.relatedRules}
              relatedRulesFromRedirects={data.relatedRulesFromRedirects}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

Rule.propTypes = {
  data: PropTypes.object.isRequired,
  location: PropTypes.object,
};

export default Rule;

export const query = graphql`
  query ($slug: String!, $uri: String!, $related: [String]!, $file: String!) {
    markdownRemark(fields: { slug: { eq: $slug } }) {
      fields {
        slug
      }
      html
      frontmatter {
        uri
        title
        guid
        authors {
          title
          url
          img
          noimage
        }
        created(formatString: "DD MMM YYYY")
        archivedreason
        related
        seoDescription
      }
      parent {
        ... on File {
          relativePath
        }
      }
    }
    categories: allMarkdownRemark(
      filter: { frontmatter: { index: { glob: $uri } } }
    ) {
      nodes {
        frontmatter {
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
    relatedRules: allMarkdownRemark(
      filter: { frontmatter: { uri: { in: $related } } }
    ) {
      nodes {
        frontmatter {
          title
          uri
        }
      }
    }
    relatedRulesFromRedirects: allMarkdownRemark(
      filter: { frontmatter: { redirects: { in: $related } } }
    ) {
      nodes {
        frontmatter {
          title
          uri
          redirects
        }
      }
    }
    history: allHistoryJson(filter: { file: { eq: $file } }) {
      nodes {
        file
        lastUpdatedBy
        lastUpdatedByEmail
        lastUpdated
        createdBy
        created
      }
    }
  }
`;
