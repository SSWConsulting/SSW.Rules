import React from "react";

export type FigurePrefix = "none" | "bad" | "ok" | "good";

export function getPrefix(prefix?: FigurePrefix): string {
  switch (prefix) {
    case "bad":
      return "❌ Figure: Bad example - ";
    case "ok":
      return "🙂 Figure: Ok example - ";
    case "good":
      return "✅ Figure: Good example - ";
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
