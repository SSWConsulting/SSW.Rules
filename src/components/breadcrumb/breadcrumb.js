import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'gatsby';
import Icon from '../../images/icon.png';
import { parentSiteUrl, siteUrl } from '../../../site-config';

const Breadcrumbs = (props) => {
  const linkRef = useRef();
  const getCategories = () => {
    return props.categories.map((cat, i) => {
      return (
        <div key={i} className="text-left">
          <Link ref={linkRef} to={cat.link}>
            <div className="breadcrumb-content px-1 hover:text-red-600">
              {cat.title}
            </div>
          </Link>
        </div>
      );
    });
  };

  return (
    <div className="breadcrumb-container">
      <div className="mx-4 mb-4 breadcrumb">
        <a href={parentSiteUrl}>
          <img alt={'SSW Consulting'} src={Icon} className="w-4" />
        </a>

        <span className="pl-1 breadcrumb__separator">&gt;</span>

        <Link ref={linkRef} to={siteUrl}>
          <div className="breadcrumb-content px-1 hover:text-red-600">
            SSW Rules
          </div>
        </Link>

        <span className="px-1">
          {props.isCategory || props.isRule || props.isArchived ? '>' : ''}
        </span>
        {props.categories && (
          <div className="text-left ">{getCategories()}</div>
        )}
        {props.isArchived ? (
          <div className="px-1">Archived</div>
        ) : props.isCategory ? (
          <div className="px-1">{props.categoryTitle}</div>
        ) : (
          <div>
            <span className="px-1">{props.isHomePage ? '' : '>'}</span>
            {props.title}
          </div>
        )}
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
