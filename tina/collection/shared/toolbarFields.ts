// TinaCMS's ToolbarOverrideType doesn't include "highlight" in its type definition,
// but supports it at runtime. We use a local type + cast to avoid the conflict.
type ToolbarItem =
  | "embed"
  | "heading"
  | "link"
  | "image"
  | "quote"
  | "ul"
  | "ol"
  | "bold"
  | "italic"
  | "highlight"
  | "code"
  | "codeBlock"
  | "raw"
  | "mermaid"
  | "table";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toolbarFields: any[] = [
  "embed",
  "heading",
  "link",
  "quote",
  "ul",
  "ol",
  "bold",
  "italic",
  "highlight",
  "code",
  "codeBlock",
  "mermaid",
  "table",
] satisfies ToolbarItem[];
