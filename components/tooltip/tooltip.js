import { useState, useEffect } from 'react';
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
            absolute bottom-full left-1/2 -translate-x-1/2 mb-2 
            whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 
            text-xs text-white opacity-0 transition-opacity duration-200
            group-hover:opacity-50
            before:absolute before:top-full before:left-1/2 before:-translate-x-1/2
            before:border-4 before:border-solid before:border-gray-800
            before:border-l-transparent before:border-r-transparent before:border-b-transparent
            before:content-['']
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
