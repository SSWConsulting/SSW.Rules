import React from 'react';
import PropTypes from 'prop-types';

const GreyBox = ({ children }) => {
  return <div className="greybox">{children}</div>;
};

GreyBox.propTypes = {
    children: PropTypes.any,
};

export default GreyBox;
