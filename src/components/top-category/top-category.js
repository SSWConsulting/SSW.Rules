import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'gatsby';
import TopCategoryHeader from '../topcategory-header/topcategory-header';

const TopCategory = ({ topcategory, categories, rules }) => {
  const linkRef = useRef();

  const findCategoryFromIndexValue = (categoryFromIndex) => {
    return categories.nodes.find(
      (c) =>
        c.parent.name.toLowerCase() === `${categoryFromIndex.toLowerCase()}`
    );
  };

  const getNumberOfRulesPerCat = (category) => {
    return category.frontmatter.index.filter((c) =>
      rules.find((r) => c == r.frontmatter.uri)
    ).length;
  };
  return (
    <>
      <TopCategoryHeader
        topCategory={topcategory}
        categories={categories.nodes}
        rules={rules}
      >
        {topcategory.frontmatter.index.map((category, i) => {
          const cat = findCategoryFromIndexValue(category);
          if (cat) {
            return (
              <div className="cat-grid-container" key={i}>
                <div className="cat-rule-num">{i + 1}.</div>
                <div className="cat-rule-link">
                  <Link ref={linkRef} to={`/${cat.parent.name}`}>
                    {cat.frontmatter.title}
                  </Link>
                </div>
                <span className="cat-rule-count d-none d-md-block">
                  {getNumberOfRulesPerCat(cat)}
                </span>
              </div>
            );
          }
        })}
      </TopCategoryHeader>
    </>
  );
};

TopCategory.propTypes = {
  topcategory: PropTypes.object,
  categories: PropTypes.object,
  rules: PropTypes.array,
};

export default TopCategory;
