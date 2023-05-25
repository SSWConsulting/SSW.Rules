import {
  GetGithubOrganisationName,
  GetOrganisations,
  GetSecretContent,
} from '../services/apiService';
import { Link, graphql } from 'gatsby';
/* eslint-disable jsx-a11y/anchor-has-content */
import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  faAngleDoubleLeft,
  faAngleDoubleRight,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';

import Acknowledgements from '../components/acknowledgements/acknowledgements';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import Bookmark from '../components/bookmark/bookmark';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import Comments from '../components/comments/comments';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import GitHubIcon from '-!svg-react-loader!../images/github.svg';
import PropTypes from 'prop-types';
import ReactDOMServer from 'react-dom/server';
import Reaction from '../components/reaction/reaction';
import RuleSideBar from '../components/rule-side-bar/rule-side-bar';
import { detectLinks } from '../helpers/convertUrlFromString';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faPencilAlt } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import formatDistance from 'date-fns/formatDistance';
import { useAuth0 } from '@auth0/auth0-react';

const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  },
});

appInsights.loadAppInsights();

const Rule = ({ data, location }) => {
  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };
  const cat = location.state ? location.state.category : null;
  const linkRef = useRef();
  const rule = data.markdownRemark;
  const categories = data.categories.nodes;
  const { user, isAuthenticated, getIdTokenClaims } = useAuth0();
  const [hiddenCount, setHiddenCount] = useState(0);

  const loadSecretContent = async (userOrgId) => {
    const hidden = document.getElementsByClassName('hidden');
    if (hidden.length != 0) {
      const token = await getIdTokenClaims();
      for (var hiddenBlock of hidden) {
        const contentID = hiddenBlock.textContent || hiddenBlock.innerText;
        const guid = contentID.substring(0, 36);
        const orgID = contentID.substring(37);
        if (parseInt(orgID) == parseInt(userOrgId)) {
          isAuthenticated && guid
            ? await GetSecretContent(guid, token.__raw)
                .then((success) => {
                  GetGithubOrganisationName(orgID)
                    .then((nameSuccess) => {
                      hiddenBlock.innerHTML =
                        ReactDOMServer.renderToStaticMarkup(
                          <SecretContent
                            content={success.content.content}
                            orgName={nameSuccess?.login ?? 'Your Organisation'}
                          />
                        );
                      hiddenBlock.className = 'secret-content';
                    })
                    .catch((err) => {
                      appInsights.trackException({
                        error: new Error(err),
                        severityLevel: 3,
                      });
                    });
                })
                .catch((err) => {
                  appInsights.trackException({
                    error: new Error(err),
                    severityLevel: 3,
                  });
                })
            : null;
        }
        setHiddenCount(document.getElementsByClassName('hidden').length);
      }
    }
  };

  const getRelatedRule = (relatedUri) => {
    var relatedRule = data.relatedRules.nodes.find(
      (r) => r.frontmatter.uri === relatedUri
    );
    if (!relatedRule) {
      for (const r of data.relatedRulesFromRedirects.nodes) {
        if (r.frontmatter.redirects) {
          for (const redirect of r.frontmatter.redirects) {
            if (redirect === relatedUri) {
              return r;
            }
          }
        }
      }
    }
    return relatedRule;
  };

  const SecretContent = (props) => {
    return (
      <>
        <div className="secret-content-heading">
          <h4>{props.orgName + ' Only: \n'}</h4>
        </div>
        <div
          style={{
            wordWrap: 'break-word',
            width: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: props.content }} //Is this a good idea? JS injection ect
        />
      </>
    );
  };
  SecretContent.propTypes = {
    content: PropTypes.string,
    orgName: PropTypes.string,
  };

  useLayoutEffect(() => {
    isAuthenticated
      ? GetOrganisations(user.sub)
          .then((success) => {
            success.organisations.forEach((org) =>
              loadSecretContent(org.organisationId)
            );
          })
          .catch((err) => {
            appInsights.trackException({
              error: new Error(err),
              severityLevel: 3,
            });
          })
      : null;
  }, [user, isAuthenticated, hiddenCount]);

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
      <div className="container full-width" id="rules" style={{}}>
        <div className="flex flex-wrap">
          <div className="w-full lg:w-3/4 md:w-1/1 px-4">
            <div className="rule-single rounded">
              <section className="rule-content">
                <div className="rule-header-container justify-between">
                  <h1>{rule.frontmatter.title}</h1>
                  <div className="rule-buttons flex flex-col sm:flex-row">
                    <Bookmark ruleId={rule.frontmatter.guid} />
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
                          size="2x"
                          className="bookmark-icon"
                        />
                      </a>
                      <span className="tooltiptext">Edit</span>
                    </button>
                    <button className="tooltip">
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://github.com/SSWConsulting/SSW.Rules.Content/tree/${process.env.CONTENT_BRANCH}/${rule.parent.relativePath}`}
                        className="tooltip tooltip-button"
                        onClick={() => {
                          appInsights.trackEvent({
                            name: 'EditMode-GitHub',
                          });
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
                {data.history && data.history.nodes[0] && (
                  <small className="history">
                    Last updated by{' '}
                    <strong>
                      {capitalizeFirstLetter(
                        data.history.nodes[0].lastUpdatedBy
                      )}
                    </strong>
                    {' on '}
                    {format(
                      new Date(data.history.nodes[0].lastUpdated),
                      'dd MMM yyyy hh:mm aaa'
                    )}
                    {` (${formatDistance(
                      new Date(data.history.nodes[0].lastUpdated),
                      new Date()
                    )} ago)`}{' '}
                    <a
                      href={`https://github.com/SSWConsulting/SSW.Rules.Content/commits/${process.env.CONTENT_BRANCH}/rules/${rule.frontmatter.uri}/rule.md`}
                    >
                      See History
                    </a>
                  </small>
                )}
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
                            __html: detectLinks(
                              rule.frontmatter.archivedreason
                            ),
                          }}
                        ></span>
                      </div>
                    </div>
                  )}
                <hr />
                <div dangerouslySetInnerHTML={{ __html: rule.html }} />
                {rule.frontmatter.related &&
                  rule.frontmatter.related.length > 0 && (
                    <div>
                      <h2>Related rules</h2>
                      <ol>
                        {rule.frontmatter.related
                          ? rule.frontmatter.related.map((relatedUri) => {
                              const relatedRule = getRelatedRule(relatedUri);
                              if (relatedRule) {
                                return (
                                  <>
                                    <li>
                                      <section>
                                        <Link
                                          ref={linkRef}
                                          to={`/${relatedRule.frontmatter.uri}`}
                                        >
                                          {relatedRule.frontmatter.title}
                                        </Link>
                                      </section>
                                    </li>
                                  </>
                                );
                              }
                            })
                          : ''}
                      </ol>
                    </div>
                  )}
                {cat && (
                  <>
                    <hr className="pb-4" />
                    <section id="previous-next" className="flex flex-col">
                      {categories
                        .filter((category) => category.parent.name === cat)
                        .map((category) => {
                          let indexCat = category.frontmatter.index.indexOf(
                            rule.frontmatter.uri
                          );
                          return (
                            <>
                              <div className="flex w-full py-2 text-sm ">
                                <div className="w-1/2 pr-6 text-right">
                                  {indexCat > 0 && (
                                    <Link
                                      ref={linkRef}
                                      to={`/${
                                        category.frontmatter.index[indexCat - 1]
                                      }`}
                                      state={{ category: cat }}
                                      className={'unstyled'}
                                    >
                                      <button
                                        className="relative box-border h-10 w-10 rounded bg-black-next-button text-lg font-medium text-white hover:bg-ssw-red"
                                        onClick={() => {
                                          appInsights.trackEvent({
                                            name: 'PreviousButtonPressed',
                                          });
                                        }}
                                      >
                                        <FontAwesomeIcon
                                          icon={faAngleDoubleLeft}
                                        />
                                      </button>
                                    </Link>
                                  )}
                                  {indexCat == 0 && (
                                    <button className="relative box-border h-10 w-10 rounded bg-gray-200 text-lg font-medium text-white">
                                      <FontAwesomeIcon
                                        icon={faAngleDoubleLeft}
                                      />
                                    </button>
                                  )}
                                </div>
                                <div className="w-1/2 pl-6 text-left">
                                  {indexCat <
                                    category.frontmatter.index.length - 1 && (
                                    <Link
                                      onClick={() => {
                                        appInsights.trackEvent({
                                          name: 'NextButtonPressed',
                                        });
                                      }}
                                      ref={linkRef}
                                      to={`/${
                                        category.frontmatter.index[indexCat + 1]
                                      }`}
                                      state={{ category: cat }}
                                    >
                                      <button className="button-relative box-border h-10 w-10 rounded bg-black-next-button text-lg font-medium text-white hover:bg-ssw-red">
                                        <FontAwesomeIcon
                                          icon={faAngleDoubleRight}
                                        />
                                      </button>
                                    </Link>
                                  )}
                                  {indexCat ==
                                    category.frontmatter.index.length - 1 && (
                                    <button className="relative box-border h-10 w-10 rounded bg-gray-200 text-lg font-medium text-white">
                                      <FontAwesomeIcon
                                        icon={faAngleDoubleRight}
                                      />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </>
                          );
                        })}
                    </section>
                  </>
                )}
                <section
                  id="more"
                  className="mt-12 flex flex-wrap pt-4 text-center"
                >
                  <div className="acknowledgements w-full lg:w-1/3">
                    <Acknowledgements authors={rule.frontmatter.authors} />
                  </div>
                  <div className="tags w-full rounded lg:w-1/3">
                    <div className="info-link-grid-container">
                      <h5>Categories</h5>
                      <div className="info-tooltip">
                        <a
                          className="info-btn-container"
                          href="https://github.com/SSWConsulting/SSW.Rules.Content/wiki/Creating-Editing-categories"
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                        <span className="tooltiptext">
                          How to add a category
                        </span>
                      </div>
                    </div>
                    {categories.map((category, i) => (
                      <div className="inline px-1" key={i}>
                        <span className="bg-ssw-red transition-colors duration-250 ease-in px-1.5 py-0.5 my-1 text-xs rounded inline-block cursor-pointer hover:opacity-80">
                          <Link ref={linkRef} to={`/${category.parent.name}`}>
                            {category.frontmatter.title
                              .replace('Rules to Better ', '')
                              .replace('Rules to ', '')}
                          </Link>
                        </span>
                      </div>
                    ))}
                    {rule.frontmatter.archivedreason?.length > 0 && (
                      <div className="inline px-1">
                        <span className="bg-ssw-red transition-colors duration-250 ease-in px-1.5 py-0.5 my-1 text-xs rounded inline-block cursor-pointer hover:opacity-80">
                          <Link ref={linkRef} to={'/archived'}>
                            Archived
                          </Link>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="likes w-full  lg:w-1/3">
                    <h5 className="rate-heading">Rate</h5>
                    <Reaction ruleId={rule.frontmatter.guid} />
                    <div className="suggestion">
                      <span className="action-btn-container">
                        <a
                          target="_blank"
                          rel="noopener noreferrer"
                          href="https://github.com/SSWConsulting/SSW.Rules.Content/issues"
                          className="action-btn-link-underlined"
                        >
                          <div className="action-btn-label">
                            Make a suggestion
                          </div>
                          <GitHubIcon
                            aria-label="logo"
                            className="action-btn-icon"
                          />{' '}
                        </a>
                      </span>
                    </div>
                  </div>
                </section>
              </section>

              <Comments
                ruleGuid={rule.frontmatter.guid}
                title={rule.frontmatter.title}
                uri={rule.frontmatter.uri}
              />
            </div>
          </div>

          <div className="w-full lg:w-1/4 md:w-1/1 px-4">
            <RuleSideBar />
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
