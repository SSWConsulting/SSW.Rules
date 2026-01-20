import { Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Prism } from "tinacms/dist/rich-text/prism";
import { toSlug } from "@/lib/utils";

// Helper function to extract text content from TinaCMS props structure
const getTextContent = (props: any): string => {
  // TinaCMS structure: props.children.props.content is an array of {text: string} objects
  const content = props?.children?.props?.content;

  if (Array.isArray(content)) {
    return content.map((node) => (typeof node.text === "string" ? node.text : "")).join("");
  }

  // Fallback for standard React children
  if (typeof props.children === "string") return props.children;
  if (Array.isArray(props.children)) {
    return props.children.map((child) => (typeof child === "string" ? child : "")).join("");
  }

  return "";
};

const createHeading =
  (Tag: "h2" | "h3" | "h4", enableAnchors = false) =>
  (props: any) => {
    if (!enableAnchors) {
      return <Tag {...props} />;
    }

    const textContent = getTextContent(props);
    const id = toSlug(textContent);

    const iconSize = Tag === "h2" ? 24 : Tag === "h3" ? 20 : 16;

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

// File extensions that should be served as downloadable files
const DOWNLOADABLE_EXTS = new Set(["pdf", "txt", "zip", "mp4", "mp3", "ics", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "sql", "cs", "json", "xml", "csv"]);

const isDownloadableFile = (href?: string): boolean => {
  if (!href) return false;
  const ext = href.split(".").pop()?.toLowerCase() || "";
  return DOWNLOADABLE_EXTS.has(ext);
};

const getFilenameFromHref = (href: string): string => {
  return href.split("/").pop() || "";
};

const rewriteUploadsToAssets = (href?: string) => {
  const TINA_CLIENT_ID = process.env.NEXT_PUBLIC_TINA_CLIENT_ID || "";
  const ALLOWED_EXTS = DOWNLOADABLE_EXTS;

  if (!href || !TINA_CLIENT_ID || !href.startsWith("/uploads/rules/")) {
    return href;
  }
  const ext = href.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTS.has(ext)) return href;
  return `https://assets.tina.io/${TINA_CLIENT_ID}/${href.replace(/^\/uploads\//, "")}`;
};

export const getTypographyComponents = (enableAnchors = false) => ({
  p: (props: any) => <p className="mb-4" {...props} />,
  a: (props: any) => {
    const originalHref = props?.url || props?.href || "";
    const href = rewriteUploadsToAssets(originalHref);
    const isInternal = typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/_next");
    const isDownloadable = isDownloadableFile(originalHref);

    if (isInternal) {
      return (
        <Link href={href} className="underline hover:text-ssw-red">
          {props.children}
        </Link>
      );
    }

    // Add download attribute for downloadable files to trigger browser download
    if (isDownloadable) {
      const filename = getFilenameFromHref(originalHref);
      return (
        <a
          className="underline hover:text-ssw-red"
          href={href}
          download={filename}
          target="_blank"
          rel="noopener noreferrer"
        >
          {props.children}
        </a>
      );
    }

    return (
      <a className="underline hover:text-ssw-red" href={href} {...props}>
        {props.children}
      </a>
    );
  },
  li: (props) => <li {...props} />,
  mark: (props: any) => <mark {...props} />,
  blockquote: (props: any) => <blockquote className="border-l-2 border-gray-900 my-4 pl-4 italic text-gray-600" {...props} />,
  code: (props: any) => <code className="bg-gray-100 py-1 px-2 rounded-sm" {...props} />,
  code_block: (props) => {
    if (!props) {
      return <></>;
    }
    return (
      <div className="[&_.prism-code]:p-4">
        <Prism lang={props.lang} value={props.value} />
      </div>
    );
  },
  h2: createHeading("h2", enableAnchors),
  h3: createHeading("h3", enableAnchors),
  h4: createHeading("h4", enableAnchors),
});

// Default export without anchors for backwards compatibility
export const typographyComponents = getTypographyComponents(false);
