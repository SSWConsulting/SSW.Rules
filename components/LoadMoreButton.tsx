import React from 'react';

export default function LoadMoreButton({
  onClick,
  disabled,
  loading,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition shadow-sm',
        disabled
          ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
          : 'border-ssw-red bg-ssw-red text-white hover:bg-ssw-red/90 hover:cursor-pointer',
      ].join(' ')}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" fill="none" />
        </svg>
      )}
      {children ?? 'Load More'}
    </button>
  );
}
