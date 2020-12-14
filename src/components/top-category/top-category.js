import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'gatsby';
import TopCategoryHeader from '../topcategory-header/topcategory-header';

const TopCategory = ({ topcategory, categories }) => {
  const linkRef = useRef();

  const findCategoryFromIndexValue = (categoryFromIndex) => {
    return categories.nodes.find(
      (c) =>
        c.parent.name.toLowerCase() === `${categoryFromIndex.toLowerCase()}`
    );
  };

  return (
    <>
      <TopCategoryHeader topCategory={topcategory} categories={categories.nodes}>
        {topcategory.frontmatter.index.map((category, i) => {
          const cat = findCategoryFromIndexValue(category);
          if (cat) {
            return (
              <li key={i}>
                {' '}
                <Link ref={linkRef} to={`/${cat.parent.name}`}>
                  {cat.frontmatter.title}
                </Link>
                <span className="d-none d-md-block">
                  ({cat.frontmatter.index.length})
                </span>
              </li>
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
};

export default TopCategory;
