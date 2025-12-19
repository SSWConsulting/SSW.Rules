'use client';

import { useState, useEffect, useRef } from 'react';
import { RiArrowDownSLine } from 'react-icons/ri';

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  showBorder?: boolean;
}

export default function Dropdown({ options, value, onChange, className = '', showBorder = false }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(option => option.value === value);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${showBorder ? 'border border-gray-200 rounded-md px-3 py-2 bg-white' : 'border-none bg-transparent'} focus:outline-none cursor-pointer flex items-center`}
        type="button"
      >
        <span>{selectedOption?.label || 'Select...'}</span>
        <RiArrowDownSLine
          className={`ml-1 text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          size={20}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="fixed mt-1 bg-white border border-gray-200 rounded-md shadow-lg min-w-[160px]" 
          style={{ 
            // lower z-index so it doesn't compete with global / admin styles
            zIndex: 1000,
            // position is already set via the className above
            left: dropdownRef.current ? dropdownRef.current.getBoundingClientRect().left : 0,
            top: dropdownRef.current ? dropdownRef.current.getBoundingClientRect().bottom + 4 : 0
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 first:rounded-t-md last:rounded-b-md transition-colors ${
                option.value === value ? 'bg-gray-50 text-ssw-red' : 'text-gray-700'
              }`}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}