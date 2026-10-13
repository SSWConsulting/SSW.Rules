export type ChatSource = { number: number; title: string; href: string };

const CODE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/;
const CITATION = /\[(\d+)\]/g;
// With the space before it, so a dropped citation leaves no gap before the punctuation that follows.
const SPACED_CITATION = /(\s*)\[(\d+)\]/g;

// Applies `rewrite` to the prose only, so "items[0]" in a code sample is never read as a citation.
function rewriteOutsideCode(text: string, rewrite: (prose: string) => string): string {
  return text
    .split(CODE)
    .map((part, index) => (index % 2 === 1 ? part : rewrite(part)))
    .join("");
}

// Gives every cited rule one number for the whole conversation. A rule cited before keeps its
// number; rules cited for the first time continue the sequence in the order the answer mentions
// them. `retrieved` holds the rules the model was shown (new ones under provisional numbers) and
// `known` the rules cited earlier. Citations to anything else are dropped.
export function numberCitations(text: string, retrieved: ChatSource[], known: ChatSource[]): { text: string; sources: ChatSource[] } {
  const byGivenNumber = new Map([...known, ...retrieved].map((source) => [source.number, source]));
  const knownNumbers = new Map(known.map((source) => [source.href, source.number]));
  let next = Math.max(0, ...known.map((source) => source.number)) + 1;
  const cited = new Map<string, ChatSource>();
  const rewritten = rewriteOutsideCode(text, (prose) =>
    prose.replace(SPACED_CITATION, (_citation, space, digits) => {
      const given = byGivenNumber.get(Number(digits));
      if (!given) return "";
      if (!cited.has(given.href)) cited.set(given.href, { ...given, number: knownNumbers.get(given.href) ?? next++ });
      return `${space}[${cited.get(given.href)?.number}]`;
    })
  );
  return { text: rewritten, sources: [...cited.values()] };
}

// Turns each citation, like [2], into a Markdown link to that rule.
export function linkCitations(text: string, sources: ChatSource[] = []): string {
  const hrefs = new Map(sources.map((source) => [String(source.number), source.href]));
  return rewriteOutsideCode(text, (prose) =>
    prose.replace(CITATION, (citation, number) => (hrefs.has(number) ? `[${citation}](${hrefs.get(number)})` : citation))
  );
}

// An answer may only link to the rules it cites. Anything else the model writes, such as a sign-out link or
// a link that a browser would read as another site, is shown as plain text.
export function isCitedRuleLink(href: string | undefined, sources: ChatSource[] = []): href is string {
  return href !== undefined && sources.some((source) => source.href === href);
}
