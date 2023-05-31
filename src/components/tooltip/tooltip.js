import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const tooltipShowDelay = 3000;
const tooltipHideDelay = 18000;

const Tooltip = ({ children, text }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (text.includes('RulesGPT')) {
      const tooltipTimeout = setTimeout(() => {
        setShowTooltip(true);
      }, tooltipShowDelay);

      const hideTooltipTimeout = setTimeout(() => {
        setShowTooltip(false);
      }, tooltipHideDelay);

      return () => {
        clearTimeout(tooltipTimeout);
        clearTimeout(hideTooltipTimeout);
      };
    }
  }, [text, location.pathname]);

  return (
    <button
      className="group relative flex h-10 items-center justify-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <span
          className="
            absolute bottom-full mb-1 whitespace-nowrap rounded-md 
            bg-gray-tooltip p-1.5 text-xs text-white transition-opacity 
            after:absolute after:top-full after:left-2/4 after:-translate-x-1/2 
            after:border-4 after:border-solid after:border-gray-tooltip after:border-l-transparent 
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
};

export default Tooltip;
