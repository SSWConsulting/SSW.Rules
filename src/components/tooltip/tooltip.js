import React from 'react';

const tooltip = ({ children, text }) => {
  return (
    <button className="tooltip-wrapper">
      {children}
      {<span className="category-tooltip tooltip-text">{text}</span>}
    </button>
  );
};

export default tooltip;
