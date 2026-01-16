import React from "react";
import { Components } from "tinacms/dist/rich-text";

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
      red: "bg-ssw-red text-white",
    };

    const bgClass = colorClasses[color] || colorClasses["yellow"];

    return (
      <mark key={index} className={`${bgClass} px-1 py-0.5 rounded-xs`}>
        {text}
      </mark>
    );
  });
}

// Helper to extract text from TinaCMS content structure and check for highlights
function getTextFromContent(props: any): string | null {
  const content = props?.children?.props?.content;

  if (Array.isArray(content)) {
    const fullText = content.map((node: any) => (typeof node.text === "string" ? node.text : "")).join("");

    if (fullText.includes("==")) {
      return fullText;
    }
  }

  return null;
}

// Helper to create a component that processes highlights
type TagOrComponent = React.ElementType;

export const withHighlightProcessing = (TagOrComp: TagOrComponent) => (props: any) => {
  const textWithHighlight = getTextFromContent(props);
  const children = textWithHighlight ? renderTextWithHighlight(textWithHighlight) : props.children;

  const Comp: any = TagOrComp;
  return <Comp {...props}>{children}</Comp>;
};

export const getMarkdownComponentMapping = (enableAnchors = false): Components<any> => {
  const typography = getTypographyComponents(enableAnchors);

  return {
    ...embedComponents,
    ...typography,

    p: withHighlightProcessing(typography.p ?? "p"),
    li: withHighlightProcessing(typography.li ?? "li"),

    h1: withHighlightProcessing("h1"),
    h2: withHighlightProcessing(typography.h2),
    h3: withHighlightProcessing(typography.h3),
    h4: withHighlightProcessing(typography.h4),
    h5: withHighlightProcessing("h5"),
    h6: withHighlightProcessing("h6"),

    blockquote: (props: any) => {
      const textWithHighlight = getTextFromContent(props);
      if (textWithHighlight) {
        return <blockquote className="border-l-2 border-gray-900 my-4 pl-4 italic text-gray-600">{renderTextWithHighlight(textWithHighlight)}</blockquote>;
      }
      return <blockquote className="border-l-2 border-gray-900 my-4 pl-4 italic text-gray-600" {...props} />;
    },
  };
};

// Default export without anchors for backwards compatibility
export const MarkdownComponentMapping: Components<any> = getMarkdownComponentMapping(false);

export default MarkdownComponentMapping;
