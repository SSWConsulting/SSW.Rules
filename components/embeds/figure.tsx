import Link from "next/link";
import React from "react";

export type FigurePrefix = "none" | "bad" | "ok" | "good";

function renderFigureText(text: string): React.ReactNode {
  // First, split by markdown links [text](url)
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  
  // Then process each part for bold markdown **text**
  return parts.map((part, index) => {
    // Check if this part is a markdown link
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      if (url.startsWith("/")) {
        return <Link key={index} href={url} className="underline">{label}</Link>;
      }
      return <a key={index} href={url} className="underline" target="_blank" rel="noopener noreferrer">{label}</a>;
    }
    
    // Process bold markdown **text** in non-link parts
    const boldParts = part.split(/(\*\*[^\*]+\*\*)/g);
    return boldParts.map((boldPart, boldIndex) => {
      const boldMatch = boldPart.match(/^\*\*([^\*]+)\*\*$/);
      if (boldMatch) {
        return <strong key={`${index}-${boldIndex}`}>{boldMatch[1]}</strong>;
      }
      return <span key={`${index}-${boldIndex}`}>{boldPart}</span>;
    });
  });
}

function getPrefixLabel(prefix?: FigurePrefix): string {
  switch (prefix) {
    case "bad":
      return "❌ Figure: Bad example";
    case "ok":
      return "🙂 Figure: OK example";
    case "good":
      return "✅ Figure: Good example";
    case "none":
    default:
      return "Figure:";
  }
}

export function getPrefix(prefix?: FigurePrefix, hasText = true): string {
  const label = getPrefixLabel(prefix);
  if (!hasText) return label;
  return prefix === "none" || !prefix ? `${label} ` : `${label} - `;
}

export function Figure({ prefix = "none", text, className }: { prefix?: FigurePrefix; text?: string; className?: string }) {
  const trimmed = text?.trim();
  const hasText = Boolean(trimmed);
  // Nothing to show when there is neither an example type nor caption text
  if (!hasText && (prefix === "none" || !prefix)) return null;
  const prefixText = getPrefix(prefix, hasText);
  return (
    <p className={`font-bold mt-1 ${className ?? ""}`.trim()}>
      {prefixText}
      {hasText ? renderFigureText(trimmed as string) : null}
    </p>
  );
}

export const inlineFigureFields = [
  { name: "figure", label: "Figure", type: "string" },
  {
    name: "figurePrefix",
    label: "Figure Prefix",
    type: "string",
    options: [
      { value: "none", label: "None" },
      { value: "bad", label: "❌ Bad example" },
      { value: "ok", label: "🙂 OK example" },
      { value: "good", label: "✅ Good example" },
    ],
  },
] as const;

export const inlineFigureDefaultItem = {
  figurePrefix: "none",
  figure: "",
};
