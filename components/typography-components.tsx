import { Prism } from "tinacms/dist/rich-text/prism";
import React from "react";
import { Link as LinkIcon } from "lucide-react";
import { toSlug } from "@/lib/utils";

// Helper function to extract text content from TinaCMS props structure
const getTextContent = (props: any): string => {
  // TinaCMS structure: props.children.props.content is an array of {text: string} objects
  const content = props?.children?.props?.content;

  if (Array.isArray(content)) {
    return content
      .map((node) => (typeof node.text === "string" ? node.text : ""))
      .join("");
  }

  // Fallback for standard React children
  if (typeof props.children === 'string') return props.children;
  if (Array.isArray(props.children)) {
    return props.children.map(child =>
      typeof child === 'string' ? child : ''
    ).join('');
  }

  return '';
};

const createHeading = (Tag: 'h2' | 'h3' | 'h4', enableAnchors = false) => (props: any) => {
  if (!enableAnchors) {
    return <Tag {...props} />;
  }

  const textContent = getTextContent(props);
  const id = toSlug(textContent);

  const iconSize = Tag === 'h2' ? 24 : Tag === 'h3' ? 20 : 16;

  return (
    <Tag id={id} className="group relative scroll-mt-24" {...props}>
      {props.children}
      <a
        href={`#${id}`}
        className="inline-block ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 no-underline"
        aria-label={`Link to ${textContent}`}
      >
        <LinkIcon size={iconSize} className="text-gray-400 hover:text-ssw-red" />
      </a>
    </Tag>
  );
};

export const getTypographyComponents = (enableAnchors = false) => ({
  p: (props: any) => (
    <p className="mb-4" {...props} />
  ),
  blockquote: (props: any) => (
    <blockquote
      className="border-l-2 border-gray-900 my-4 pl-4 italic text-gray-600"
      {...props}
    />
  ),
  code: (props: any) => (
    <code className="bg-gray-100 py-1 px-2 rounded-sm" {...props} />
  ),
  code_block: (props) => {
    if (!props) {
      return <></>;
    }
    return <Prism lang={props.lang} value={props.value} />;
  },
  h2: createHeading('h2', enableAnchors),
  h3: createHeading('h3', enableAnchors),
  h4: createHeading('h4', enableAnchors),
});

// Default export without anchors for backwards compatibility
export const typographyComponents = getTypographyComponents(false);
