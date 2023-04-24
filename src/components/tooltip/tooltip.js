import React, { useState } from 'react';

const tooltip = ({ children, text }) => {
  const [show, setShow] = useState(true);

  const handleMouseEnter = () => {
    setShow(true);
  };

  const handleMouseLeave = () => {
    setShow(true);
  };

  return (
    <button
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="tooltip-wrapper"
    >
      {children}
      {show && <span className="category-tooltip tooltip-text">{text}</span>}
    </button>
  );
};

export default tooltip;
