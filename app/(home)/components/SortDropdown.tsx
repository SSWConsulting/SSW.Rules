import React from 'react';

interface SortDropdownProps {
  options: { value: string; label: string }[];
  selectedValue: string;
  onChange: (value: string) => void;
}

const SortDropdown: React.FC<SortDropdownProps> = ({ options, selectedValue, onChange }) => (
  <div className="sort-dropdown mb-4 flex justify-end">
    <select
      value={selectedValue}
      onChange={(e) => onChange(e.target.value)}
      className="sort-select p-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 transition ease-in-out duration-200"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

export default SortDropdown;
