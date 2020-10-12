import React from 'react';
import PropTypes from 'prop-types';

const GreyBox = ({ children, attrs }) => {
  return (
  <div className="custom-block greybox">
    {attrs.figure && <div className="custom-block-heading">{attrs.figure}</div>}
    <div className="custom-block-body">{children}</div>
  </div>
  );
};

GreyBox.propTypes = {
  children: PropTypes.any,
};

export default GreyBox;
