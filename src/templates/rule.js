import React, { useRef } from 'react';
import { graphql, Link } from 'gatsby';
import { format } from 'date-fns';
import formatDistance from 'date-fns/formatDistance';
import PropTypes from 'prop-types';
import {
  faAngleDoubleLeft,
  faAngleDoubleRight,
  faLightbulb,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Breadcrumb from '../components/breadcrumb/breadcrumb';
import Reaction from '../components/reaction/reaction';

const Rule = ({ data, location }) => {
  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const cat = location.state ? location.state.category : null;
  const linkRef = useRef();
  const rule = data.markdownRemark;
  const categories = data.categories.nodes;
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
        <section className="rule-content p-12 mb-20">
          <h1>{rule.frontmatter.title}</h1>
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
              <h5>Acknowledgements</h5>
              <div className="flex flex-row flex-wrap justify-center">
                {rule.frontmatter.authors &&
                  rule.frontmatter.authors.map((author, index) => (
                    <div
                      style={{
                        width: '75px',
                        height: '75px',
                        overflow: 'hidden',
                        borderRadius: '50%',
                        marginRight: '10px',
                      }}
                      key={`author_${index}`}
                    >
                      <a
                        href={`https://ssw.com.au/people/${author.title.replace(
                          / /g,
                          '-'
                        )}`}
                      >
                        <img
                          src={`https://github.com/SSWConsulting/SSW.People.Profiles/raw/main/${author.title.replace(
                            / /g,
                            '-'
                          )}/Images/${author.title.replace(
                            / /g,
                            '-'
                          )}-Profile.jpg`}
                          alt={author.title}
                          title={author.title}
                        />
                      </a>
                      <span className="tooltiptext">{author.title}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="tags rounded w-full lg:w-1/3">
              <h5>Categories</h5>
              {categories.map((category, i) => (
                <div className="px-1 inline" key={i}>
                  <span>
                    <Link ref={linkRef} to={`/${category.parent.name}`}>
                      {category.frontmatter.title
                        .replace('Rules to Better ', '')
                        .replace('Rules to ', '')}
                    </Link>
                  </span>
                </div>
              ))}
            </div>
            <div className="likes w-full lg:w-1/3">
              <h5 className="h5-margin-override">Feedback</h5>
              <Reaction />
              <div className="suggestion">
                <span className="action-btn-container">
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href="https://github.com/SSWConsulting/SSW.Rules.Content/issues"
                    className="action-btn-link"
                  >
                    <div className="action-btn-label">Make a suggestion</div>
                    <FontAwesomeIcon
                      icon={faLightbulb}
                      className="action-btn-icon"
                    />{' '}
                  </a>
                </span>
              </div>
            </div>
          </section>
        </section>
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
        authors {
          title
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
