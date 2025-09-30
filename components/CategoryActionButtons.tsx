'use client';

import React from 'react';
import Link from 'next/link';
import { BiArchive, BiUser, BiLinkExternal } from 'react-icons/bi';

const CategoryActionButtons: React.FC = () => {
  return (
    <div className="flex gap-4 p-4 justify-center">
      <Link
        href="/orphaned"
        className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white rounded-md border hover:bg-gray-50 hover:text-ssw-red transition-colors duration-200 no-underline"
      >
        <BiUser className="w-4 h-4" />
        <span>Orphaned Rules</span>
      </Link>
      
      <Link
        href="/archived"
        className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white rounded-md border hover:bg-gray-50 hover:text-ssw-red transition-colors duration-200 no-underline"
      >
        <BiArchive className="w-4 h-4" />
        <span>Archived Rules</span>
      </Link>
      
      <a
        href="https://www.ssw.com.au/ssw/Standards/Default.aspx" 
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white rounded-md border hover:bg-gray-50 hover:text-ssw-red transition-colors duration-200 no-underline"
      >
        <BiLinkExternal className="w-4 h-4" />
        <span>Unmigrated Rules</span>
      </a>
    </div>
  );
};

export default CategoryActionButtons;