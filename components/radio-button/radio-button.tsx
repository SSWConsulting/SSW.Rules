"use client";

import React from "react";

interface RadioButtonProps {
  id: string;
  value: string;
  selectedOption: string;
  handleOptionChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  labelText: string;
  className?: string;
}

const RadioButton: React.FC<RadioButtonProps> = ({ id, value, selectedOption, handleOptionChange, labelText, className = "" }) => {
  const isSelected = selectedOption === value;

  const handleButtonClick = () => {
    // Create a synthetic change event to match the expected interface
    const syntheticEvent = {
      target: {
        value: value,
        type: "radio",
        checked: true,
      },
    } as React.ChangeEvent<HTMLInputElement>;

    handleOptionChange(syntheticEvent);
  };

  return (
    <button
      type="button"
      id={id}
      className={`group px-4 py-1 text-sm cursor-pointer hover:text-white transition-colors border ${className} ${
        isSelected ? "bg-ssw-red" : "bg-white hover:bg-ssw-red"
      }`}
      onClick={handleButtonClick}
      aria-pressed={isSelected}
    >
      <span className={`transition-colors ${isSelected ? "text-white" : "text-gray-700 group-hover:text-white"}`}>{labelText}</span>
    </button>
  );
};

export default RadioButton;
