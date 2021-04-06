/* eslint-disable jsx-a11y/anchor-has-content */
import React, { useRef, useState, useLayoutEffect } from 'react';
import ReactDOMServer from 'react-dom/server';
import { graphql, Link } from 'gatsby';
import { format } from 'date-fns';
import formatDistance from 'date-fns/formatDistance';
import PropTypes from 'prop-types';
import {
  faAngleDoubleLeft,
  faAngleDoubleRight,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import GitHubIcon from '-!svg-react-loader!../images/github.svg';
import Bookmark from '../components/bookmark/bookmark';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import Acknowledgements from '../components/acknowledgements/acknowledgements';
import Reaction from '../components/reaction/reaction';
import Comments from '../components/comments/comments';
import { useAuth0 } from '@auth0/auth0-react';
import {
  GetOrganisations,
  GetSecretContent,
  GetGithubOrganisationName,
} from '../services/apiService';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  },
});

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
                      hiddenBlock.innerHTML = ReactDOMServer.renderToStaticMarkup(
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
      <div className="rule-single rounded">
        <section className="rule-content">
          <div className="rule-header-container">
            <h1>{rule.frontmatter.title}</h1>
            <Bookmark ruleId={rule.frontmatter.guid} />
          </div>
          {data.history && data.history.nodes[0] && (
            <small className="history">
              Created on{' '}
              {format(new Date(data.history.nodes[0].created), 'dd MMM yyyy')} |
              Last updated by{' '}
              <strong>
                {capitalizeFirstLetter(data.history.nodes[0].lastUpdatedBy)}
              </strong>
              {' on '}
              {format(
                new Date(data.history.nodes[0].lastUpdated),
                'dd MMM yyyy hh:mm aaa'
              )}
              {` (${formatDistance(
                new Date(data.history.nodes[0].lastUpdated),
                new Date()
              )} ago)`}
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
                  {rule.frontmatter.archivedreason}
                </div>
              </div>
            )}
          <hr />
          <div dangerouslySetInnerHTML={{ __html: rule.html }} />
          {rule.frontmatter.related && rule.frontmatter.related.length > 0 && (
            <div>
              <h2>Related Rules</h2>
              <ol>
                {rule.frontmatter.related
                  ? rule.frontmatter.related.map((relatedRuleUri) => {
                      const relatedRule = data.relatedRules.nodes.find(
                        (r) => r.frontmatter.uri === relatedRuleUri
                      );
                      if (relatedRule) {
                        return (
                          <>
                            <li>
                              <section>
                                <p>
                                  <Link
                                    ref={linkRef}
                                    to={`/${relatedRule.frontmatter.uri}`}
                                  >
                                    {relatedRule.frontmatter.title}
                                  </Link>
                                </p>
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
                        <div className="w-full flex py-2 text-sm ">
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
                                <button className="button-next bg-ssw-red text-white">
                                  <FontAwesomeIcon icon={faAngleDoubleLeft} />
                                </button>
                              </Link>
                            )}
                            {indexCat == 0 && (
                              <button className="button-next bg-ssw-grey text-white">
                                <FontAwesomeIcon icon={faAngleDoubleLeft} />
                              </button>
                            )}
                          </div>
                          <div className="w-1/2 pl-6 text-left">
                            {indexCat <
                              category.frontmatter.index.length - 1 && (
                              <Link
                                ref={linkRef}
                                to={`/${
                                  category.frontmatter.index[indexCat + 1]
                                }`}
                                state={{ category: cat }}
                              >
                                <button className="button-next bg-ssw-red text-white">
                                  <FontAwesomeIcon icon={faAngleDoubleRight} />
                                </button>
                              </Link>
                            )}
                            {indexCat ==
                              category.frontmatter.index.length - 1 && (
                              <button className="button-next bg-ssw-grey text-white">
                                <FontAwesomeIcon icon={faAngleDoubleRight} />
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
          <section id="more" className="pt-4 mt-12 flex flex-wrap text-center">
            <div className="acknowledgements w-full lg:w-1/3">
              <Acknowledgements authors={rule.frontmatter.authors} />
            </div>
            <div className="tags rounded w-full lg:w-1/3">
              <div className="info-link-grid-container">
                <h5>Categories</h5>
                <div className="info-tooltip">
                  <a
                    className="info-btn-container"
                    href="https://github.com/SSWConsulting/SSW.Rules.Content/wiki/Creating-Editing-categories"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                  <span className="tooltiptext">How to add a Category</span>
                </div>
              </div>
              {categories.map((category, i) => (
                <div className="px-1 inline" key={i}>
                  <span className="category-tag">
                    <Link ref={linkRef} to={`/${category.parent.name}`}>
                      {category.frontmatter.title
                        .replace('Rules to Better ', '')
                        .replace('Rules to ', '')}
                    </Link>
                  </span>
                </div>
              ))}
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
                    <div className="action-btn-label">Make a suggestion</div>
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
  );
};

Rule.propTypes = {
  data: PropTypes.object.isRequired,
  location: PropTypes.object,
};

export default Rule;

export const query = graphql`
  query($slug: String!, $uri: String!, $related: [String]!, $file: String!) {
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
