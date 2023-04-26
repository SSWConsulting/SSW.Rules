import React from 'react';

const tooltip = ({ children, text }) => {
  return (
    <button className="group relative flex h-10 items-center justify-center">
      {children}
      {
        <span
          className="
            invisible absolute bottom-full mb-1 whitespace-nowrap rounded-md 
            bg-gray-tooltip p-1.5 text-xs text-white transition-opacity 
            after:absolute after:top-full after:left-2/4 after:-translate-x-1/2 
            after:border-4 after:border-solid after:border-gray-tooltip after:border-l-transparent 
            after:border-r-transparent after:border-b-transparent after:content-[''] group-hover:visible
          "
        >
          {text}
        </span>
      }
    </button>
  );
};

export default tooltip;
