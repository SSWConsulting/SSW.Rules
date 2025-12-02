import { Components } from "tinacms/dist/rich-text";
import React from "react";

import { embedComponents } from "@/components/embeds";
import { getTypographyComponents } from "@/components/typography-components";

export function renderTextWithHighlight(content: string): React.ReactNode {
  if (typeof content !== "string") return content;

  // Match patterns like ==yellow:Something== or ==Something==
  const parts = content.split(/(==[^=]+==)/g);

  return parts.map((part, index) => {
    const match = part.match(/^==([^=]+)==$/);
    if (!match) return <span key={index}>{part}</span>;

    const inner = match[1].trim();
    const [maybeColor, ...rest] = inner.split(":");
    const text = rest.length > 0 ? rest.join(":").trim() : maybeColor;
    const color = rest.length > 0 ? maybeColor.toLowerCase() : "yellow";

    const colorClasses: Record<string, string> = {
      yellow: "bg-yellow-200",
      red: "bg-ssw-red text-white"
    };

    const bgClass = colorClasses[color] || colorClasses["yellow"];

    return (
      <mark key={index} className={`${bgClass} px-1 py-0.5 rounded-xs`}>
        {text}
      </mark>
    );
  });
}

export const getMarkdownComponentMapping = (enableAnchors = false): Components<any> => ({
  ...embedComponents,
  ...getTypographyComponents(enableAnchors),
  p: (props) => {
    const content = props?.children?.props?.content;

    if (Array.isArray(content)) {
      const fullText = content
        .map((node) => (typeof node.text === "string" ? node.text : ""))
        .join("");

      if (fullText.includes("==")) {
        return <p>{renderTextWithHighlight(fullText)}</p>;
      }
    }

    return <p {...props} />;
  }
});

// Default export without anchors for backwards compatibility
export const MarkdownComponentMapping: Components<any> = getMarkdownComponentMapping(false);

export default MarkdownComponentMapping;
