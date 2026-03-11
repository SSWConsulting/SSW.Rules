interface AstNode {
  type?: string;
  name?: string;
  text?: string;
  children?: AstNode[];
}

/**
 * Recursively collects plain text from a TinaCMS rich-text AST node.
 * Skips JSX/MDX elements (custom embeds, images, etc.) — only extracts prose text.
 */
function collectText(node: AstNode): string {
  if (node.type === "text") return node.text ?? "";
  if (!node.children) return "";
  // Skip block-level JSX embeds (e.g. VideoEmbed, endIntro, etc.)
  if (node.type === "mdxJsxFlowElement") return "";
  return node.children.map(collectText).join("");
}

/**
 * Extracts a plain-text preview from the intro section of a TinaCMS rule body.
 * Uses only content before the `endIntro` marker, or the first few paragraphs if absent.
 *
 * @param body - The TinaCMS rich-text AST (body field on a Rule)
 * @param maxLength - Maximum number of characters to return (default 200)
 */
export function extractBodyPreview(body: { children?: AstNode[] } | null | undefined, maxLength = 200): string {
  if (!body?.children) return "";

  const endIntroIndex = body.children.findIndex((n) => n?.name === "endIntro");
  const introChildren = endIntroIndex === -1 ? body.children.slice(0, 3) : body.children.slice(0, endIntroIndex);

  const text = introChildren
    .map(collectText)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}
