import './breadcrumb.css';

import { parentSiteUrl, siteUrlRelative } from '../../../site-config';

import Icon from '../../images/icon.png';
import { Link } from 'gatsby';
import PropTypes from 'prop-types';
import React from 'react';

const Breadcrumbs = ({
  categories,
  isCategory,
  isHomePage,
  breadcrumbText,
}) => {
  const getCategories = () => {
    if (categories.length > 0) {
      return categories.map((cat, i) => {
        return (
          <Link
            key={i}
            to={cat.link}
            className="flex-1 transition ease-in-out delay-75 hover:text-ssw-red duration-150 underline decoration-underline unstyled hover:decoration-ssw-red"
          >
            {cat.title.replace(/Rules to(?: Better)?/, '').trim()}
          </Link>
        );
      });
    }

    return (
      <Link
        to={'/orphaned'}
        className="flex-1 transition ease-in-out delay-75 hover:text-ssw-red duration-150 underline decoration-underline unstyled hover:decoration-ssw-red"
      >
        Orphaned
      </Link>
    );
  };

  const setBreadcrumbText = () => {
    let breadcrumbContent =
      breadcrumbText || (isCategory ? 'This category' : 'This rule');

    return <li>{breadcrumbContent}</li>;
  };

  return (
    <div className="m-4 md:mx-2 md:ml-4 h-full flex">
      <Link to={parentSiteUrl} className="mx-2 h-full">
        <img alt="SSW Foursquare" src={Icon} className="w-4 mt-1" />
      </Link>
      <div className="w-full">
        <ul className="flex flex-col md:flex-row align-middle breadcrumb">
          <li className="w-auto flex">
            <Link
              to={siteUrlRelative}
              className="flex-1 align-middle transition ease-in-out delay-75 hover:text-ssw-red duration-150 underline decoration-underline hover:decoration-ssw-red unstyled"
            >
              SSW Rules
            </Link>
          </li>
          {categories ? (
            <li className="flex-initial flex-col align-middle breadcrumb-category">
              {getCategories()}
            </li>
          ) : (
            <></>
          )}
          {!isHomePage && setBreadcrumbText()}
        </ul>
      </div>
    </div>
  );
};

Breadcrumbs.propTypes = {
  categories: PropTypes.array,
  isCategory: PropTypes.bool,
  isRule: PropTypes.bool,
  isHomePage: PropTypes.bool,
  breadcrumbText: PropTypes.string,
};

export default Breadcrumbs;
