import React from 'react';
import PropTypes from 'prop-types';
import { parentSiteUrl } from '../../../site-config';
import Icon from '../../images/icon.png';

const Breadcrumbs = (props) => {
  return (
    <div className="breadcrumb-container">
      <div className="mx-6 mb-3 breadcrumb">
        <a href={parentSiteUrl}>
          <img alt={'SSW Consulting'} src={Icon} className="w-4" />
        </a>
        <span className="breadcrumb__separator">&gt;</span>
        {props.category} {'>'} {props.title}
      </div>
    </div>
  );
};

Breadcrumbs.propTypes = {
  title: PropTypes.any,
  category: PropTypes.any,
};

export default Breadcrumbs;
