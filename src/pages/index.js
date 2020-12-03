import React from 'react';
import { StaticQuery, graphql } from 'gatsby';
import PropTypes from 'prop-types';
import { faTwitter } from '@fortawesome/free-brands-svg-icons';
import { config } from '@fortawesome/fontawesome-svg-core';
import {
  faArchive,
  faFlag,
  faQuoteLeft,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import TopCategory from '../components/top-category/top-category';
import Contact from '../components/contact/contact';
import NumberFormat from 'react-number-format';
import Breadcrumb from '../components/breadcrumb/breadcrumb';

config.autoAddCss = false;

const Index = ({ data }) => {
  const displayTopCategories = (topcategory) => {
    return (
      <>
        <section className="mb-5 relative">
          <TopCategory
            topcategory={topcategory}
            categories={data.categories}
          ></TopCategory>
        </section>
      </>
    );
  };

  return (
    <div className="w-full">
      <Breadcrumb isHomePage={true} />
      <div className="container" id="rules">
        <div className="flex">
          <div className="w-3/4 px-4">
            <div className="rule-index no-gutters rounded">
              {data.main.nodes.map((element) => {
                return element.frontmatter.index.map((category) => {
                  const cat = data.topCategories.nodes.find(
                    (c) =>
                      c.parent.relativeDirectory.toLowerCase() ===
                      `categories/${category.toLowerCase()}`
                  );
                  if (cat) {
                    return displayTopCategories(cat);
                  }
                });
              })}
            </div>
            <section>
              <p>
                <a href="/archived">
                  <FontAwesomeIcon icon={faArchive} /> Show archived rules
                </a>
              </p>
              <p>
                <a href="/out-of-dates">
                  <FontAwesomeIcon icon={faFlag} /> Show rules flagged as out of
                  date
                </a>
              </p>
            </section>
          </div>

          <div className="w-1/4 px-4" id="sidebar">
            <section className="rules-counter">
              <h2>
                <NumberFormat
                  value={data.rules.nodes.length}
                  displayType={'text'}
                  thousandSeparator={true}
                />
              </h2>
              <p>SSW Rules</p>
            </section>
            <section>
              <h4>Why all these rules?</h4>
              <p>
                Read about the{' '}
                <a
                  href="https://www.codemag.com/article/0605091"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  History of SSW Rules
                </a>
                , published in CoDe Magazine.
              </p>
            </section>

            <section>
              <h4>Help and improve our rules</h4>
              <div className="testimonial text-center rounded p-3">
                <div className="avatar">
                  <img
                    className="inline rounded-full"
                    src="https://adamcogan.com/wp-content/uploads/2018/07/adam-bw.jpg"
                    alt="Adam Cogan"
                  />
                </div>
                <h5>Adam Cogan</h5>
                <h6>Chief Software Architect at SSW</h6>
                <blockquote>
                  <FontAwesomeIcon icon={faQuoteLeft} /> Nothing great is easy.
                  The SSW rules are a great resource for developers all around
                  the world. However it’s hard to keep rules current and
                  correct. If you spot a rule that is out of date, please{' '}
                  <a href="/email">email us</a>, or if you are cool{' '}
                  <a href="/twitter">
                    <FontAwesomeIcon icon={faTwitter} /> tweet me
                  </a>
                  .
                </blockquote>
              </div>
            </section>
            <section>
              <h4>Join the conversation</h4>
              <a
                href="https://twitter.com/intent/tweet?button_hashtag=SSWRules&ref_src=twsrc%5Etfw"
                className="button twitter-hashtag-button"
              >
                <FontAwesomeIcon icon={faTwitter} /> Tweet #SSWRules
              </a>
            </section>
            <section>
              <h4>About SSW</h4>
              <p>
                SSW Consulting has over 25 years of experience developing
                awesome Microsoft solutions that today build on top of
                AngularJS, Azure, TFS, SharePoint, .NET, Dynamics CRM and SQL
                Server. With 40+ consultants in 5 countries, we have delivered
                the best in the business to more than 1,000 clients in 15
                countries.
              </p>
            </section>
            <section>
              <Contact />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
Index.propTypes = {
  data: PropTypes.object.isRequired,
  search: PropTypes.object.isRequired,
  pageContext: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
};

const IndexWithQuery = (props) => (
  <StaticQuery
    query={graphql`
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
            }
          }
        }
      }
    `}
    render={(data) => <Index data={data} {...props} />}
  />
);

export default IndexWithQuery;
