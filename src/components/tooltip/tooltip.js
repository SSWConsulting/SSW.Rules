import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const Tooltip = ({ children, text, showDelay, hideDelay, className = '' }) => {
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
    <button
      className={`group relative flex h-10 items-center justify-center ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <span
          className="
            absolute left-full top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md 
            bg-tooltip-grey p-1.5 text-xs text-white transition-opacity bg-opacity-100
            after:absolute after:left-0 after:top-1/2 after:-translate-y-1/2 after:-translate-x-full 
            after:border-4 after:border-solid after:border-tooltip-grey after:border-t-transparent 
            after:border-b-transparent after:border-l-tooltip-grey after:content-[''] z-50           
            sm:left-auto sm:top-auto sm:bottom-full sm:ml-0 sm:mb-1 
            sm:-translate-y-0 sm:translate-x-0 sm:after:top-full sm:after:left-2/4 sm:after:-translate-x-1/2 
            sm:after:-translate-y-0 sm:after:border-l-transparent sm:after:border-r-transparent sm:after:border-b-tooltip-grey
          "
        >
          {text}
        </span>
      )}
    </button>
  );
};

Tooltip.propTypes = {
  children: PropTypes.object.isRequired,
  text: PropTypes.string.isRequired,
  showDelay: PropTypes.number,
  hideDelay: PropTypes.number,
  className: PropTypes.string,
};

export default Tooltip;
