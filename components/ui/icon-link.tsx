'use client';

import React from 'react';
import Link from 'next/link';
import Tooltip from '@/components/tooltip/tooltip';

export interface IconLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  tooltipOpaque?: boolean;
  target?: string;
  rel?: string;
}

const IconLink: React.FC<IconLinkProps> = ({
  href,
  children,
  className = '',
  title,
  tooltipOpaque = false,
  target,
  rel
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors hover:text-[var(--ssw-red)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

  const link = (
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

  if (title) {
    return (
      <Tooltip text={title} opaque={tooltipOpaque}>
        {link}
      </Tooltip>
    );
  }

  return link;
};

export default IconLink;
