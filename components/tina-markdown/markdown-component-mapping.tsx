import { Components } from "tinacms/dist/rich-text";
import React from "react";

import { embedComponents } from "@/components/embeds";
import { typographyComponents } from "@/components/typography-components";

export function renderTextWithHighlight(content): React.ReactNode {
    if (typeof content !== "string") return content;
  
    const parts = content.split(/(==[^=]+==|<mark>.*?<\/mark>)/g);
  
    return parts.map((part, index) => {
      if (/^==[^=]+==$/.test(part)) {
        return <mark key={index} className="bg-yellow-200 px-1 py-0.5 rounded-sm">{part.slice(2, -2)}</mark>
      }
  
      if (/^<mark>.*<\/mark>$/.test(part)) {
        const inner = part.replace(/^<mark>(.*?)<\/mark>$/, "$1");
        return <mark key={index} className="bg-yellow-200 px-1 py-0.5 rounded-sm">{inner}</mark>
      }
  
      return <span key={index}>{part}</span>;
    });
}


export const MarkdownComponentMapping: Components<any> = {
  ...embedComponents,
  ...typographyComponents,
  p: (props) => {
    const content = props?.children?.props?.content;

    if (Array.isArray(content)) {
      const fullText = content
        .map((node) => (typeof node.text === "string" ? node.text : ""))
        .join("");

      if (fullText.includes("==") || fullText.includes("<mark>")) {
        return <p>{renderTextWithHighlight(fullText)}</p>;
      }
    }

    return <p {...props} />;
  }
};

export default MarkdownComponentMapping;
