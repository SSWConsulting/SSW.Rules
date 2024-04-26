import {
  GetGithubOrganisationName,
  GetOrganisations,
  GetSecretContent,
} from '../services/apiService';
import { graphql } from 'gatsby';
/* eslint-disable jsx-a11y/anchor-has-content */
import React, { useLayoutEffect, useState } from 'react';
import {
  faExclamationTriangle,
  faPencilAlt,
} from '@fortawesome/free-solid-svg-icons';
import { pathPrefix } from '../../site-config.js';
import markdownIt from 'markdown-it';

import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import Bookmark from '../components/bookmark/bookmark';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import Comments from '../components/comments/comments';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PropTypes from 'prop-types';
import ReactDOMServer from 'react-dom/server';
import Reaction from '../components/reaction/reaction';
import RuleSideBar from '../components/rule-side-bar/rule-side-bar';
import formatDistance from 'date-fns/formatDistance';
import { format } from 'date-fns';
import { useAuth0 } from '@auth0/auth0-react';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

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
      <div className="container full-width m-auto" id="rules">
        <div className="flex flex-wrap">
          <div className={'w-full px-4 lg:w-3/4 md:w-1/1'}>
            <div className="rule-single rounded relative">
              <section className="rule-content mb-0">
                <div className="rule-header-container justify-between display:flex flex-col md:flex-row">
                  <div>
                    <h1>{rule.frontmatter.title}</h1>
                    {data.history && data.history.nodes[0] && (
                      <small className="history">
                        <span className="opacity-60">Last updated by</span>{' '}
                        <strong>
                          {capitalizeFirstLetter(
                            data.history.nodes[0].lastUpdatedBy
                          )}
                        </strong>{' '}
                        <span className="opacity-60">
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
                <section
                  id="more"
                  className="mt-12 flex flex-wrap pt-6 pb-6 lg:pb-12 text-center -mb-6"
                >
                  <div className="likes w-full">
                    <Reaction ruleId={rule.frontmatter.guid} />
                  </div>
                </section>
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

              <Comments
                ruleGuid={rule.frontmatter.guid}
                title={rule.frontmatter.title}
                uri={rule.frontmatter.uri}
              />
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
        description
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
