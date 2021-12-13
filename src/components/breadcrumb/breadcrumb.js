import './breadcrumb.css';

import React, { useRef } from 'react';
import { parentSiteUrl, siteUrl } from '../../../site-config';

import Icon from '../../images/icon.png';
import { Link } from 'gatsby';
import PropTypes from 'prop-types';

const Breadcrumbs = (props) => {
  const getCategories = () => {
    return props.categories.map((cat, i) => {
      return (
        <Link key={i} to={cat.link}>
          {cat.title}
        </Link>
      );
    });
  };

  return (
    <div className="breadcrumb-container">
      <Link to={parentSiteUrl}>
        <img alt="SSW Foursquare" src={Icon} className="w-4" />
      </Link>
      <ul className="breadcrumb">
        <li>
          <Link to={siteUrl} className="breadcrumb-content">
            SSW Rules
          </Link>
        </li>
        {props.categories && (
          <li className="breadcrumb-category">{getCategories()}</li>
        )}
        {props.isArchived ? (
          <li>Archived</li>
        ) : props.isCategory ? (
          <li>{props.categoryTitle}</li>
        ) : (
          <li>{props.title}</li>
        )}
      </ul>
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
