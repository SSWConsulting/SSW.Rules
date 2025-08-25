'use client';

import React from 'react';

interface RadioButtonProps {
  id: string;
  name: string;
  value: string;
  selectedOption: string;
  handleOptionChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  labelText: string;
  icon: React.ReactNode;
}

const RadioButton: React.FC<RadioButtonProps> = ({
  id,
  name,
  value,
  selectedOption,
  handleOptionChange,
  labelText,
  icon
}) => {
  const isSelected = selectedOption === value;
  
  const handleButtonClick = () => {
    // Create a synthetic change event to match the expected interface
    const syntheticEvent = {
      target: {
        value: value,
        name: name,
        type: 'radio',
        checked: true
      }
    } as React.ChangeEvent<HTMLInputElement>;
    
    handleOptionChange(syntheticEvent);
  };
  
  return (
    <button
      type="button"
      id={id}
      className={`group flex items-center justify-center p-3 min-w-[200px] cursor-pointer hover:text-white transition-colors ${
        isSelected ? 'bg-[#525252]' : 'bg-[#e7e5e4] hover:bg-[#525252]'
      }`}
      onClick={handleButtonClick}
      aria-pressed={isSelected}
    >
      <span className={`flex items-center transition-colors ${
        isSelected ? 'text-white' : 'text-gray-700 group-hover:text-white'
      }`}>
        <span className="mr-2">{icon}</span>
        {labelText}
      </span>
    </button>
  );
};

export default RadioButton;
