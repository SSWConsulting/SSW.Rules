import React from 'react';
import Spinner from './Spinner';

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
      {loading && <Spinner size="sm" inline />}
      {children ?? 'Load More'}
    </button>
  );
}
