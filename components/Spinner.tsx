import React from 'react';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type SpinnerPosition = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface SpinnerProps {
  size?: SpinnerSize;
  position?: SpinnerPosition;
  className?: string;
  inline?: boolean;
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const positionClasses: Record<SpinnerPosition, string> = {
  center: 'flex justify-center items-center',
  left: 'flex justify-start items-center',
  right: 'flex justify-end items-center',
  top: 'flex justify-center items-start',
  bottom: 'flex justify-center items-end',
  'top-left': 'flex justify-start items-start',
  'top-right': 'flex justify-end items-start',
  'bottom-left': 'flex justify-start items-end',
  'bottom-right': 'flex justify-end items-end',
};

export default function Spinner({ 
  size = 'md', 
  position = 'center', 
  className = '',
  inline = false
}: SpinnerProps) {
  if (inline) {
    return (
      <svg 
        className={`animate-spin ${sizeClasses[size]} ${className}`} 
        viewBox="0 0 24 24" 
        aria-hidden="true"
      >
        <circle 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4" 
          fill="none" 
          opacity="0.25" 
        />
        <path 
          d="M22 12a10 10 0 0 1-10 10" 
          stroke="currentColor" 
          strokeWidth="4" 
          fill="none" 
        />
      </svg>
    );
  }

  return (
    <div className={`${positionClasses[position]} ${className}`}>
      <svg 
        className={`animate-spin ${sizeClasses[size]}`} 
        viewBox="0 0 24 24" 
        aria-hidden="true"
      >
        <circle 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4" 
          fill="none" 
          opacity="0.25" 
        />
        <path 
          d="M22 12a10 10 0 0 1-10 10" 
          stroke="currentColor" 
          strokeWidth="4" 
          fill="none" 
        />
      </svg>
    </div>
  );
}