import Link from "next/link";
import React from "react";

export type FigurePrefix = "none" | "bad" | "ok" | "good";

function renderFigureText(text: string): React.ReactNode {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!match) return <span key={index}>{part}</span>;
    const [, label, url] = match;
    if (url.startsWith("/")) {
      return <Link key={index} href={url} className="underline">{label}</Link>;
    }
    return <a key={index} href={url} className="underline" target="_blank" rel="noopener noreferrer">{label}</a>;
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
