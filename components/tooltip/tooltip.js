"use client";

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const Tooltip = ({ children, text, showDelay, hideDelay, className = '', opaque = false }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (showDelay && hideDelay) {
      const tooltipTimeout = setTimeout(() => {
        setShowTooltip(true);
      }, showDelay);

      const hideTooltipTimeout = setTimeout(() => {
        setShowTooltip(false);
      }, hideDelay);

      return () => {
        clearTimeout(tooltipTimeout);
        clearTimeout(hideTooltipTimeout);
      };
    }
  }, [text]);

  return (
    <span
      className={`group relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <span
          className={
            `absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-xs text-white transition-opacity duration-200 before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-solid before:border-gray-800 before:border-l-transparent before:border-r-transparent before:border-b-transparent before:content-[''] ${
              opaque ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
            }`
          }
        >
          {text}
        </span>
      )}
    </span>
  );
};

Tooltip.propTypes = {
  children: PropTypes.node.isRequired,
  text: PropTypes.string.isRequired,
  showDelay: PropTypes.number,
  hideDelay: PropTypes.number,
  className: PropTypes.string,
  opaque: PropTypes.bool,
};

export default Tooltip;
