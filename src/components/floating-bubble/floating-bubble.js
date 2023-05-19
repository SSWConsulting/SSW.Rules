import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments } from '@fortawesome/free-solid-svg-icons';

const FloatingBubble = () => {
  const handleBubbleClick = () => {
    location.href = 'https://rulesgpt.ssw.com.au/';
  };

  return (
    <button
      onClick={() => handleBubbleClick()}
      className="fixed bottom-4 right-4 w-16 h-16 bg-ssw-red rounded-full shadow-lg flex items-center justify-center cursor-pointer"
    >
      <FontAwesomeIcon icon={faComments} size="2x" className="text-white" />
    </button>
  );
};

export default FloatingBubble;
