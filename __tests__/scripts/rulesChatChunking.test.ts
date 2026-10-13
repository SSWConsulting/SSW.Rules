/**
 * @jest-environment node
 */
import { chunkRule, MAX_CHUNK_CHARS, toPlainText } from "@/scripts/rules-chat/chunking.mjs";

const chunksOf = (mdx: string) => chunkRule(toPlainText(mdx));

describe("rules chat chunking", () => {
  it("keeps an embed with a body as one paragraph, ending at the /> after the body", () => {
    const mdx = 'Intro.\n\n<boxEmbed style="info" body={<>Inside text <img src="a.png" /> more text</>} figure="A box" />\n\nAfter.';

    const [chunk] = chunksOf(mdx);

    expect(chunk.content.split("\n\n")).toEqual(["Intro.", "Inside text   more text\nCaption: A box", "After."]);
  });

  it("starts a bad example with its label", () => {
    const [chunk] = chunksOf('<imageEmbed figurePrefix="bad" figure="Messy code" src="x.png" />');

    expect(chunk.content.startsWith("Bad example (what not to do):")).toBe(true);
  });

  it("joins a Markdown caption to the embed above it and labels it once", () => {
    const mdx = 'Before.\n\n<imageEmbed src="x.png" figure="Tabs" />\n\n**❌ Bad example - Too many tabs**\n\nAfter.';

    const [chunk] = chunksOf(mdx);
    const paragraphs = chunk.content.split("\n\n");

    expect(paragraphs).toEqual(["Before.", "Bad example (what not to do):\nPicture: Tabs\n**❌ Bad example - Too many tabs**", "After."]);
  });

  it("doesn't treat a # comment inside a code fence as a heading", () => {
    const mdx = "## Setup\n\n```bash\nnpm install\n\n# comment\nnpm start\n```";

    const chunks = chunksOf(mdx);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBe("Setup");
    expect(chunks[0].content).toContain("# comment");
  });

  it("splits a long labelled example into pieces that each repeat the label", () => {
    const mdx = `<boxEmbed figurePrefix="good" body={<>${"x".repeat(4000)}</>} />`;

    const pieces = chunksOf(mdx);

    expect(pieces).toHaveLength(3);
    for (const piece of pieces) {
      expect(piece.content.startsWith("Good example (recommended):")).toBe(true);
      expect(piece.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    }
  });

  it("keeps every chunk of a long section under the size limit and under its heading", () => {
    const paragraph = "Sentence about reviews. ".repeat(30).trim();
    const mdx = `## Reviews\n\n${Array.from({ length: 12 }, () => paragraph).join("\n\n")}`;

    const chunks = chunksOf(mdx);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.heading).toBe("Reviews");
      expect(chunk.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    }
  });
});
