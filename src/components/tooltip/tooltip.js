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
            absolute bottom-full mb-1 whitespace-nowrap rounded-md 
            bg-tooltip-grey p-1.5 text-xs text-white transition-opacity 
            after:absolute after:top-full after:left-2/4 after:-translate-x-1/2 
            after:border-4 after:border-solid after:border-tooltip-grey after:border-l-transparent 
            after:border-r-transparent after:border-b-transparent after:content-['']
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
