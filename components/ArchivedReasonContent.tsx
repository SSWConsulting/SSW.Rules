"use client";

import Link from "next/link";
import React from "react";

interface ArchivedReasonContentProps {
  reason: string;
  className?: string;
}

interface ParsedSegment {
  type: "text" | "link";
  content: string;
  href?: string;
}

function parseArchivedReason(reason: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];

  // Match Markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  let lastIndex = 0;
  let match;

  while ((match = markdownLinkRegex.exec(reason)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const textBefore = reason.slice(lastIndex, match.index);
      if (textBefore) {
        segments.push({ type: "text", content: textBefore });
      }
    }

    const linkText = match[1];
    const linkHref = match[2];

    segments.push({
      type: "link",
      content: linkText,
      href: linkHref,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (lastIndex < reason.length) {
    const remainingText = reason.slice(lastIndex);
    if (remainingText) {
      segments.push({ type: "text", content: remainingText });
    }
  }

  // If no markdown links were found, check for plain URLs
  if (segments.length === 0 || (segments.length === 1 && segments[0].type === "text")) {
    const text = segments.length === 1 ? segments[0].content : reason;
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g;

    const newSegments: ParsedSegment[] = [];
    let urlLastIndex = 0;
    let urlMatch;

    while ((urlMatch = urlRegex.exec(text)) !== null) {
      if (urlMatch.index > urlLastIndex) {
        const textBefore = text.slice(urlLastIndex, urlMatch.index);
        if (textBefore) {
          newSegments.push({ type: "text", content: textBefore });
        }
      }

      newSegments.push({
        type: "link",
        content: urlMatch[1],
        href: urlMatch[1],
      });

      urlLastIndex = urlMatch.index + urlMatch[0].length;
    }

    if (urlLastIndex < text.length) {
      const remainingText = text.slice(urlLastIndex);
      if (remainingText) {
        newSegments.push({ type: "text", content: remainingText });
      }
    }

    if (newSegments.length > 0) {
      return newSegments;
    }
  }

  return segments.length > 0 ? segments : [{ type: "text", content: reason }];
}

function isInternalLink(href: string): boolean {
  // Internal links start with / or are relative paths (not starting with http/https)
  if (href.startsWith("/")) {
    return true;
  }

  // Check if it's an SSW rules link that should be treated as internal
  const sswRulesPattern = /^https?:\/\/(www\.)?ssw\.com\.au\/rules\//;
  return sswRulesPattern.test(href);
}

function normalizeInternalHref(href: string): string {
  // Convert SSW rules URLs to internal paths
  const sswRulesPattern = /^https?:\/\/(www\.)?ssw\.com\.au\/rules\/(.+)$/;
  const match = href.match(sswRulesPattern);

  if (match) {
    return `/${match[2]}`;
  }

  // Handle /uploads/rules/xxx paths - convert to /xxx
  if (href.startsWith("/uploads/rules/")) {
    const rulePath = href.replace("/uploads/rules/", "");
    return `/${rulePath}`;
  }

  // Handle /rules/xxx paths - convert to /xxx (avoid /rules/rules/xxx duplication)
  if (href.startsWith("/rules/")) {
    return href.replace(/^\/rules/, "");
  }

  return href;
}

export default function ArchivedReasonContent({ reason, className = "" }: ArchivedReasonContentProps) {
  const segments = parseArchivedReason(reason);

  const linkClassName = "text-ssw-red underline hover:opacity-80";

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <React.Fragment key={index}>{segment.content}</React.Fragment>;
        }

        const href = segment.href || "";
        const isInternal = isInternalLink(href);

        if (isInternal) {
          const normalizedHref = normalizeInternalHref(href);
          return (
            <Link key={index} href={normalizedHref} className={linkClassName}>
              {segment.content}
            </Link>
          );
        }

        return (
          <a key={index} href={href} className={linkClassName} target="_blank" rel="noopener noreferrer nofollow">
            {segment.content}
          </a>
        );
      })}
    </span>
  );
}