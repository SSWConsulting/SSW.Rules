"use client";

import React from "react";

interface RadioButtonProps {
  id: string;
  value: string;
  selectedOption: string;
  handleOptionChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  labelText: string;
  position?: "first" | "middle" | "last";
}

const RadioButton: React.FC<RadioButtonProps> = ({ id, value, selectedOption, handleOptionChange, labelText, position }) => {
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

  const getBorderClasses = () => {
    if (!position) {
      return "border rounded";
    }

    if (position === "first") {
      return "border rounded-l-md rounded-r-none";
    } else if (position === "last") {
      return "border border-l-0 rounded-r-md rounded-l-none";
    } else if (position === "middle") {
      return "border border-l-0 rounded-none";
    }

    return "border rounded";
  };

  return (
    <button
      type="button"
      id={id}
      className={`px-1 sm:px-4 py-1 text-sm cursor-pointer transition-colors ${getBorderClasses()} ${
        isSelected ? "bg-ssw-red text-white" : "bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900"
      }`}
      onClick={handleButtonClick}
      aria-pressed={isSelected}
    >
      {labelText}
    </button>
  );
};

export default RadioButton;
