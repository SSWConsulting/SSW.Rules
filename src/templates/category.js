import React, { useRef, useState } from 'react';
import { graphql, Link } from 'gatsby';
import PropTypes from 'prop-types';
import MD from 'gatsby-custom-md';
import GreyBox from '../components/greybox/greybox';

export default function Category({ data }) {
  const linkRef = useRef();
  const category = data.markdownRemark;

  const [selectedOption, setSelectedOption] = useState('all');
  const [isTitleOnly, setTitleOnly] = useState(false);

  const handleOptionChange = (e) => {
    setSelectedOption(e.target.value);
    setTitleOnly(e.target.value === 'titleOnly');
  };

  const components = {
    greyBox: GreyBox,
  };

  return (
    <div className="w-full">
      <div className="rule-category rounded">
        <section className="mb-20 pb-2 pt-4 px-12 rounded">
          <h2 className="cat-title rounded-t">
            {category.frontmatter.title}
            <span className="rule-count">
              {category.frontmatter.index.length}
            </span>
          </h2>
          <MD components={components} htmlAst={category.htmlAst} />
          <div className="how-to-view text-center p-4 d-print-none">
            <div className="custom-control custom-radio custom-control-inline">
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
                className="custom-control-label ml-1"
                htmlFor="customRadioInline1"
              >
                View titles only
              </label>
            </div>
            <div className="custom-control custom-radio custom-control-inline">
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
                className="custom-control-label ml-1"
                htmlFor="customRadioInline2"
              >
                Show everything
              </label>
            </div>
          </div>
          <div className="p-12">
            <ol className="list-decimal">
              {category.frontmatter.index.map((ruleUri) => {
                const rule = data.rule.nodes.find(
                  (r) => r.frontmatter.uri === ruleUri
                );
                if (rule) {
                  return (
                    <>
                      <li className="pb-4">
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
                          className={`rule-content px-4 mb-5 ${
                            isTitleOnly ? 'hidden' : 'visible'
                          }`}
                        >
                          <MD components={components} htmlAst={rule.htmlAst} />
                          <div
                            dangerouslySetInnerHTML={{ __html: rule.html }}
                          />
                        </section>
                      </li>
                    </>
                  );
                }
              })}
            </ol>
          </div>
        </section>
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
        frontmatter {
          uri
          title
        }
        htmlAst
      }
    }
  }
`;
