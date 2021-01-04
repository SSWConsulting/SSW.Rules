import React, { useState } from 'react';
import { faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PropTypes from 'prop-types';

const TopCategoryHeader = ({ children, topCategory, categories, rules }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const findCategoryFromIndexValue = (categoryFromIndex) => {
    return categories.find(
      (c) =>
        c.parent.name.toLowerCase() === `${categoryFromIndex.toLowerCase()}`
    );
  };

  const getNumberOfRulesForCat = (category) => {
    return category.frontmatter.index.filter((c) =>
      rules.find((r) => c == r.frontmatter.uri)
    ).length;
  };

  return (
    <>
      <h6
        className={`top-category-header px-4 py-2 flex ${
          isCollapsed ? 'rounded' : 'rounded-t'
        }`}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full text-left"
        >
          {topCategory.frontmatter.title}{' '}
          <span className="number">
            (
            {topCategory.frontmatter.index
              .map((category) => {
                const cat = findCategoryFromIndexValue(category);
                if (cat) {
                  return getNumberOfRulesForCat(cat);
                } else {
                  return 0;
                }
              })
              .reduce((total, currentValue) => total + currentValue, 0)}
            )
          </span>
          <span className="collapse-icon">
            <FontAwesomeIcon icon={isCollapsed ? faPlus : faMinus} />
          </span>
        </button>
      </h6>
      <ol className={`pt-3 px-4 py-2 ${isCollapsed ? 'hidden' : 'block'}`}>
        {children}
      </ol>
    </>
  );
};
TopCategoryHeader.propTypes = {
  children: PropTypes.node.isRequired,
  topCategory: PropTypes.object.isRequired,
  categories: PropTypes.array.isRequired,
  rules: PropTypes.array,
};

export default TopCategoryHeader;
