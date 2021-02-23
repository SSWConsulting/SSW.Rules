import React, { useRef, useState } from 'react';
import { graphql, Link } from 'gatsby';
import PropTypes from 'prop-types';
import MD from 'gatsby-custom-md';
import GreyBox from '../components/greybox/greybox';
import Breadcrumb from '../components/breadcrumb/breadcrumb';

export default function Category({ data }) {
  const linkRef = useRef();
  const category = data.markdownRemark;

  const [selectedOption, setSelectedOption] = useState('all');

  const handleOptionChange = (e) => {
    setSelectedOption(e.target.value);
  };

  const components = {
    greyBox: GreyBox,
  };

  var rules = data.rule.nodes
    .filter((r) => {
      return !r.frontmatter.archivedreason;
    })
    .filter((r) => {
      return category.frontmatter.index.includes(r.frontmatter.uri);
    });

  return (
    <div>
      <Breadcrumb
        categoryTitle={category.frontmatter.title}
        isCategory={true}
      />
      <div className="w-full">
        <div className="rule-category rounded">
          <section className="mb-20 pb-2 rounded">
            <h2 className="cat-title py-4 px-12 rounded-t">
              {category.frontmatter.title}
              <span className="rule-count">
                {rules.length} {rules.length > 1 ? 'Rules' : 'Rule'}
              </span>
            </h2>
            <div className="rule-category-top pt-5 py-4 px-6">
              <MD components={components} htmlAst={category.htmlAst} />
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
                {category.frontmatter.index.map((r) => {
                  var rule = rules.find((rr) => rr.frontmatter.uri == r);
                  if (!rule) {
                    return;
                  }
                  return (
                    <>
                      <li className="">
                        <section className="rule-content-title px-4">
                          <h2>
                            <Link
                              ref={linkRef}
                              to={`/${rule.frontmatter.uri}`}
                              state={{ category: category.parent.name }}
                            >
                              {rule.frontmatter.title}
                            </Link>
                          </h2>
                        </section>

                        <section
                          className={`rule-content mb-5
                            ${selectedOption === 'all' ? 'visible' : 'hidden'}`}
                        >
                          <MD components={components} htmlAst={rule.htmlAst} />
                        </section>

                        <section
                          className={`rule-content mb-5
                          ${selectedOption === 'blurb' ? 'visible' : 'hidden'}`}
                        >
                          <div
                            dangerouslySetInnerHTML={{ __html: rule.excerpt }}
                          />
                          <p className="pt-5 pb-0">
                            Read more about{' '}
                            <Link
                              ref={linkRef}
                              to={`/${rule.frontmatter.uri}`}
                              state={{ category: category.parent.name }}
                            >
                              {rule.frontmatter.title}
                            </Link>
                          </p>
                        </section>
                      </li>
                    </>
                  );
                })}
              </ol>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

Category.propTypes = {
  data: PropTypes.object.isRequired,
  pageContext: PropTypes.object.isRequired,
};

export const query = graphql`
  query($slug: String!, $index: [String]!) {
    markdownRemark(fields: { slug: { eq: $slug } }) {
      htmlAst
      frontmatter {
        title
        index
      }
      parent {
        ... on File {
          relativePath
          name
        }
      }
    }
    rule: allMarkdownRemark(filter: { frontmatter: { uri: { in: $index } } }) {
      nodes {
        excerpt(format: HTML, pruneLength: 500)
        frontmatter {
          uri
          archivedreason
          title
        }
        htmlAst
      }
    }
  }
`;
