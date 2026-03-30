type ToolbarOverrideType =
  | "heading"
  | "link"
  | "image"
  | "quote"
  | "ul"
  | "ol"
  | "code"
  | "codeBlock"
  | "bold"
  | "italic"
  | "highlight"
  | "raw"
  | "embed"
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
] satisfies ToolbarOverrideType[];
