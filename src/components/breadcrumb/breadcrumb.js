import React from 'react';
import PropTypes from 'prop-types';
import Icon from '../../images/icon.png';
import { parentSiteUrl, siteUrl } from '../../../site-config';

const Breadcrumbs = (props) => {
  return (
    <div className="breadcrumb-container">
      <div className="mx-6 mb-3 breadcrumb">
        <a href={parentSiteUrl}>
          <img alt={'SSW Consulting'} src={Icon} className="w-4" />
        </a>

        <span className="breadcrumb__separator">&gt;</span>

        <a className="px-1" href={siteUrl}>
          SSW Rules
        </a>

        <div className="px-1">
          {props.isCategory || props.isRule ? '>' : ''}
        </div>

        <div className="text-left underline">{props.category}</div>

        {props.isCategory ? (
          <div className="px-1 underline text-gray-900">
            {props.categoryTitle}
          </div>
        ) : (
          <div className="px-1 text-gray-900">
            {props.isHomePage ? '' : '>'} {props.title}
          </div>
        )}
      </div>
    </div>
  );
};

Breadcrumbs.propTypes = {
  title: PropTypes.any,
  category: PropTypes.any,
  categoryTitle: PropTypes.any,
  isCategory: PropTypes.bool,
  isRule: PropTypes.bool,
  isHomePage: PropTypes.bool,
};

export default Breadcrumbs;
