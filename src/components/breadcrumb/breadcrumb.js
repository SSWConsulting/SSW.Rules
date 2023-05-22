import './breadcrumb.css';

import { parentSiteUrl, siteUrl } from '../../../site-config';

import Icon from '../../images/icon.png';
import { Link } from 'gatsby';
import PropTypes from 'prop-types';
import React from 'react';

const Breadcrumbs = (props) => {
  const getCategories = () => {
    if (props.categories.length > 0) {
      return props.categories.map((cat, i) => {
        return (
          <Link
            key={i}
            to={cat.link}
            className="flex-1 transition ease-in-out delay-75 hover:text-ssw-red duration-150 underline decoration-underline unstyled hover:decoration-ssw-red"
          >
            {cat.title}
          </Link>
        );
      });
    }

    return (
      <Link to={'/orphaned'} className="flex-1">
        Orphaned
      </Link>
    );
  };

  const checkCategory = (prop) => {
    if (prop.isHomePage) {
      return <></>;
    }

    if (props.isCategory) {
      return <li className="mr-8">{props.categoryTitle}</li>;
    }

    return <li className="mr-8">{props.title}</li>;
  };

  return (
    <div className="m-4 mx-8 md:mx-2 md:ml-4 h-full flex">
      <Link to={parentSiteUrl} className="mx-2 h-full">
        <img alt="SSW Foursquare" src={Icon} className="w-4 mt-1" />
      </Link>
      <div className="w-full">
        <ul className="flex flex-col md:flex-row align-middle breadcrumb mr-8">
          <li className="w-auto flex">
            <Link
              to={siteUrl}
              className="flex-1 align-middle transition ease-in-out delay-75 hover:text-ssw-red duration-150 underline decoration-underline hover:decoration-ssw-red unstyled"
            >
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
