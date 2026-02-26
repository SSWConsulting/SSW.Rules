"use client";

import { isExternalLink, isExternalSSWSite } from "@/lib/linkUtils";
import Link from "next/link";
import React, { PropsWithChildren } from "react";

interface CustomLinkProps extends PropsWithChildren {
  href: string;
  target?: string;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

const isTinaSite = (href: string): boolean => {
  const tinaSitePatterns = /^(https:\/\/(?:www\.)?tina\.io(?:\/|$))/i;
  return tinaSitePatterns.test(href);
};

export const CustomLink: React.FC<CustomLinkProps> = ({
  href,
  target,
  className,
  children,
  title,
  style,
  ...props
}) => {
  const isExternal = isExternalLink(href);
  const isAnSSWBrandedSite = isExternalSSWSite(href) || isTinaSite(href);

  if (!href) return <>{children}</>;
  return (
    <>
      {isExternal ? (
        <a
          className={className}
          href={href}
          target={target || "_blank"}
          rel={isAnSSWBrandedSite ? "" : "noopener noreferrer nofollow"}
          title={title}
          style={style}
          {...props}
        >
          {children}
        </a>
      ) : (
        <Link
          className={className}
          target={target}
          href={href}
          title={title}
          {...props}
          style={style}
          prefetch={true}
        >
          {children}
        </Link>
      )}
    </>
  );
};
