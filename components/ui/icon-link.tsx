"use client";

import Link from "next/link";
import React from "react";
import Tooltip from "@/components/tooltip/tooltip";

export interface IconLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  tooltipOpaque?: boolean;
  target?: string;
  rel?: string;
  onClick?: () => void;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const IconLink: React.FC<IconLinkProps> = ({ href, children, className = "", title, tooltipOpaque = false, target, rel, onClick }) => {
  const baseClasses =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors hover:text-[var(--ssw-red)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  let adjustedHref = href;

  if (href.startsWith("http")) {
    adjustedHref = href;
  } else {
    adjustedHref = `${basePath}${href}`;
  }

  const link = (
    <a href={adjustedHref} className={`${baseClasses} ${className}`} target={target} rel={rel} onClick={onClick}>
      {children}
    </a>
  );
  if (title) {
    return (
      <Tooltip text={title} showDelay={0} hideDelay={0} opaque={tooltipOpaque}>
        {link}
      </Tooltip>
    );
  }

  return link;
};

export default IconLink;
