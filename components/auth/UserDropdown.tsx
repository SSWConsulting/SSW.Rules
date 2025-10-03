'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaGithub, FaUser, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from './UserClientProvider';

type AnyUser = {
  name?: string;
  email?: string;
  picture?: string;
  nickname?: string;
  sub?: string;
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function UserDropdown() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [isPositioned, setIsPositioned] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const u = (user || {}) as AnyUser;
  const displayName = u.nickname || u.name;

  const handleOpen = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 8, // 8px de marge
        right: window.innerWidth - rect.right,
      });
      setIsPositioned(true);
      setOpen(true);
    } else {
      setOpen(false);
      setIsPositioned(false);
    }
  };

  const dropdownMenu = open && isPositioned && (
    <div
      role='menu'
      className='fixed z-[9999] w-60 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900'
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`,
      }}
    >
      <span
        aria-hidden
        className='pointer-events-none absolute -top-[10px] right-4 h-0 w-0
                    border-l-[10px] border-l-transparent
                    border-r-[10px] border-r-transparent
                    border-b-[10px] border-b-gray-200
                    dark:border-b-gray-700'
      />
      <span
        aria-hidden
        className='pointer-events-none absolute -top-[9px] right-4 h-0 w-0
                    border-l-[9px] border-l-transparent
                    border-r-[9px] border-r-transparent
                    border-b-[9px] border-b-white
                    dark:border-b-gray-900'
      />
      <div className='flex items-center gap-3 p-4'>
        <img src={u.picture} alt={displayName} className='h-10 w-10 rounded-full object-cover' referrerPolicy='no-referrer' />
        <div className='min-w-0'>
          <p className='truncate text-sm font-semibold'>{displayName}</p>
          {u.email && <p className='truncate text-xs text-gray-500 dark:text-gray-400'>{u.email}</p>}
        </div>
      </div>

      <div className='border-t border-gray-200 dark:border-gray-700' />

      <nav className='p-1'>
        <a
          href={`https://www.github.com/${u.nickname}`}
          target='_blank'
          rel='noreferrer'
          className='flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50 dark:hover:bg-gray-800'
        >
          <FaGithub size='18' /> GitHub Profile
        </a>

        <Link
          href='/profile'
          prefetch={false}
          className='flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50 dark:hover:bg-gray-800'
        >
          <FaUser size='18' /> SSW.Rules Profile
        </Link>

        <a
          href={`${basePath}/auth/logout?returnTo=${window.location.origin}${basePath}`}
          className='flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50 dark:hover:bg-gray-800'
        >
          <FaSignOutAlt size='18' /> Sign Out
        </a>
      </nav>
    </div>
  );

  return (
    <>
      <div className='relative flex items-center'>
        <button
          ref={buttonRef}
          onClick={handleOpen}
          className='flex items-center gap-2 rounded-full border border-gray-200 bg-white shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
          aria-haspopup='menu'
          aria-expanded={open}
        >
          <img src={u.picture} alt={displayName} className='h-10 w-10 rounded-full object-cover cursor-pointer' referrerPolicy='no-referrer' />
        </button>
      </div>

      {typeof window !== 'undefined' && dropdownMenu && createPortal(dropdownMenu, document.body)}
    </>
  );
}
