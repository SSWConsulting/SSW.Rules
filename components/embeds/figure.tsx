import React from "react";

export type FigurePrefix = "none" | "bad" | "ok" | "good";

export function getPrefix(prefix?: FigurePrefix): string {
  switch (prefix) {
    case "bad":
      return "❌ Figure: ";
    case "ok":
      return "😐 Figure: ";
    case "good":
      return "✅ Figure: ";
    case "none":
    default:
      return "Figure: ";
  }
}

export function Figure({ prefix = "none", text, className }: { prefix?: FigurePrefix; text?: string; className?: string }) {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  const prefixText = getPrefix(prefix);
  return (
    <p className={`font-bold mt-1 ${className ?? ""}`.trim()}>
      {prefixText}
      {trimmed}
    </p>
  );
}

export const inlineFigureFields = [
  {
    name: "figurePrefix",
    label: "Figure Prefix",
    type: "string",
    options: [
      { value: "none", label: "Default" },
      { value: "bad", label: "Bad Example" },
      { value: "ok", label: "OK Example" },
      { value: "good", label: "Good Example" },
    ],
  },
  { name: "figure", label: "Figure", type: "string" },
] as const;

export const inlineFigureDefaultItem = {
  figurePrefix: "none",
  figure: "",
};
