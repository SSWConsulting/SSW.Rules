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
  faChevronRight,
  faChevronLeft,
} from '@fortawesome/free-solid-svg-icons';

import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import Bookmark from '../components/bookmark/bookmark';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import Comments from '../components/comments/comments';
import Tooltip from '../components/tooltip/tooltip';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ClockIcon from '-!svg-react-loader!../images/clock-regular.svg';
import SquarePen from '-!svg-react-loader!../images/square-pen-solid.svg';
import SquareGit from '-!svg-react-loader!../images/square-github.svg';
import PropTypes from 'prop-types';
import ReactDOMServer from 'react-dom/server';
import Reaction from '../components/reaction/reaction';
import RuleSideBar from '../components/rule-side-bar/rule-side-bar';
import { detectLinks } from '../helpers/convertUrlFromString';
import { format } from 'date-fns';
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
  const rule = data.markdownRemark;
  const categories = data.categories.nodes;
  const { user, isAuthenticated, getIdTokenClaims } = useAuth0();
  const [hiddenCount, setHiddenCount] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

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
          <div
            className={`w-full px-4 ${isCollapsed ? '' : 'lg:w-3/4 md:w-1/1'}`}
          >
            <div className="rule-single rounded relative">
              <section className="rule-content mb-0">
                <div className="rule-header-container justify-between">
                  <h1>{rule.frontmatter.title}</h1>
                  <button
                    className="absolute hidden lg:block top-6 right-0 w-6 h-14 leading-[3.5rem] text-center text bg-ssw-grey text-neutral-500 rounded-l-md cursor-pointer"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                  >
                    {isCollapsed ? (
                      <FontAwesomeIcon icon={faChevronLeft} />
                    ) : (
                      <FontAwesomeIcon icon={faChevronRight} />
                    )}
                  </button>
                </div>
                <div className="lg:flex">
                  {data.history && data.history.nodes[0] && (
                    <small className="history flex items-center">
                      Last updated by
                      <strong className="mx-0.5">
                        {capitalizeFirstLetter(
                          data.history.nodes[0].lastUpdatedBy
                        )}
                      </strong>
                      {format(
                        new Date(data.history.nodes[0].lastUpdated),
                        'dd MMM yyyy'
                      )}
                      <a
                        className="not-external"
                        href={`https://github.com/SSWConsulting/SSW.Rules.Content/commits/${process.env.CONTENT_BRANCH}/rules/${rule.frontmatter.uri}/rule.md`}
                      >
                        <ClockIcon className="w-3 ml-1" />
                      </a>
                    </small>
                  )}
                  <div className="flex my-2 lg:w-40 justify-center">
                    <Bookmark ruleId={rule.frontmatter.guid} isSmall={true} />
                    <Tooltip text="Edit">
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`/rules/admin/#/collections/rule/entries/${rule.frontmatter.uri}/rule`}
                        className="not-external"
                        onClick={() => {
                          appInsights.trackEvent({
                            name: 'EditMode-NetlifyCMS',
                          });
                        }}
                      >
                        <SquarePen className="w-icon lg:mx-6 mx-16 hover:fill-ssw-red hover:w-6" />
                      </a>
                    </Tooltip>
                    <Tooltip text="Edit in GitHub">
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://github.com/SSWConsulting/SSW.Rules.Content/tree/${process.env.CONTENT_BRANCH}/${rule.parent.relativePath}`}
                        onClick={() => {
                          appInsights.trackEvent({
                            name: 'EditMode-GitHub',
                          });
                        }}
                        className="not-external"
                      >
                        <SquareGit className="w-icon hover:fill-ssw-red hover:w-6" />
                      </a>
                    </Tooltip>
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
                <section
                  id="more"
                  className="mt-12 flex flex-wrap pt-10 text-center -mb-6"
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

          <div
            className={`hidden ${
              isCollapsed ? '' : 'lg:w-1/4 lg:block md:hidden'
            }`}
          >
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
