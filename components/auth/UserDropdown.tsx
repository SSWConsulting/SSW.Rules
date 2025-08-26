'use client';

import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0';
import { useRef, useState } from 'react';
import { FaGithub, FaUser, FaSignOutAlt } from "react-icons/fa";

type AnyUser = {
  name?: string;
  email?: string;
  picture?: string;
  nickname?: string;
  sub?: string;
};

export default function UserDropdown() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const u = (user || {}) as AnyUser;
  const displayName = u.nickname || u.name;

  return (
    <div className="relative flex items-center" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-gray-200 bg-white shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <img
          src={u.picture}
          alt={displayName}
          className="h-8 w-8 rounded-full object-cover cursor-pointer"
          referrerPolicy="no-referrer"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 top-3/4 w-60 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex items-center gap-3 p-4">
            <img
              src={u.picture}
              alt={displayName}
              className="h-10 w-10 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              {u.email && (
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {u.email}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700" />

          <nav className="p-1">
            <a
              href={`https://www.github.com/${u.nickname}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50 dark:hover:bg-gray-800"
            >
              <FaGithub size="18" /> GitHub Profile
            </a>

            <Link
              href="/rules/profile"
              prefetch={false}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50 dark:hover:bg-gray-800"
            >
              <FaUser size="18" /> SSW.Rules Profile
            </Link>

            <a
              href="/auth/logout"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50 dark:hover:bg-gray-800"
            >
              <FaSignOutAlt size="18" /> Sign Out
            </a>
          </nav>
        </div>
      )}
    </div>
  );
}