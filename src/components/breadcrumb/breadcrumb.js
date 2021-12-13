import './breadcrumb.css';

import { parentSiteUrl, siteUrl } from '../../../site-config';

import Icon from '../../images/icon.png';
import { Link } from 'gatsby';
import PropTypes from 'prop-types';
import React from 'react';

const Breadcrumbs = (props) => {
  const getCategories = () => {
    return props.categories.map((cat, i) => {
      return (
        <Link key={i} to={cat.link} className="flex-1 mr-4">
          {cat.title}
        </Link>
      );
    });
  };

  const checkCategory = (prop) => {
    if (prop.isHomePage) {
      return <></>;
    }

    if (props.isCategory) {
      return <li>{props.categoryTitle}</li>;
    }

    return <li>{props.title}</li>;
  };

  return (
    <div className="w-full m-4 md:mx-12 mx-8 h-full flex min-w-full">
      <Link to={parentSiteUrl} className="mx-2 h-full">
        <img alt="SSW Foursquare" src={Icon} className="w-4 mt-1" />
      </Link>
      <div className="w-full">
        <ul className="flex flex-col md:flex-row align-middle breadcrumb ">
          <li className="w-auto flex">
            <Link to={siteUrl} className="flex-1 align-middle">
              SSW Rules
            </Link>
          </li>
          {props.categories ? (
            <li className="flex-initial flex-col align-middle breadcrumb-category">
              {getCategories()}
            </li>
          ) : (
            <></>
          )}
          {props.isArchived ? <li>Archived</li> : checkCategory(props)}
        </ul>
      </div>
    </div>
  );
};

Breadcrumbs.propTypes = {
  title: PropTypes.any,
  categories: PropTypes.array,
  categoryTitle: PropTypes.string,
  isCategory: PropTypes.bool,
  isRule: PropTypes.bool,
  isHomePage: PropTypes.bool,
  isArchived: PropTypes.bool,
};

export default Breadcrumbs;
