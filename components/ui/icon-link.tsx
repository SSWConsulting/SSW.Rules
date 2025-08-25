'use client';

import React from 'react';
import Link from 'next/link';

export interface IconLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  target?: string;
  rel?: string;
}

const IconLink: React.FC<IconLinkProps> = ({
  href,
  children,
  className = '',
  title,
  target,
  rel
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

  return (
    <Link
      href={href}
      className={`${baseClasses} ${className}`}
      title={title}
      target={target}
      rel={rel}
    >
      {children}
    </Link>
  );
};

export default IconLink;
