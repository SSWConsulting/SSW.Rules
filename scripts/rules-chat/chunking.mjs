// Turns a rule's MDX into plain-text chunks for embedding. Pure functions, so they can be tested without a database or
// a model.

export const MAX_CHUNK_CHARS = 1800;

const attribute = (block, name) => block.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]?.trim() ?? "";

// Marks a paragraph that came from an embed, so a caption written under it can be attached. Removed before chunking.
const EMBED_MARK = "\u0001";
const EXAMPLE_LABELS = {
  bad: "Bad example (what not to do):",
  good: "Good example (recommended):",
  ok: "OK example (acceptable, not ideal):",
};
const LABEL_PATTERN = /^(?:Bad|Good|OK) example \([^)]*\):$/;
// A caption line written in plain Markdown under an example, such as "**❌ Bad example - ...**".
const CAPTION_PATTERN = /^[*\s]*(?:[❌✅]\s*)?[*\s]*(?:(?:Figure|Video|Image):\s*)?(bad|good|ok) example\b/i;

const BODY_OPEN = "body={<>";
const BODY_CLOSE = "</>}";

// Finds where the embed starting at `start` ends. Its body can hold "/>" from nested tags, so the
// closing "/>" is the first one after the body, or the first one at all when there is no body.
function findEmbedEnd(text, start) {
  const firstClose = text.indexOf("/>", start);
  const bodyStart = text.indexOf(BODY_OPEN, start);
  if (bodyStart === -1 || (firstClose !== -1 && firstClose < bodyStart)) return firstClose === -1 ? null : { end: firstClose + 2, body: null };
  const bodyEnd = text.indexOf(BODY_CLOSE, bodyStart);
  const close = bodyEnd === -1 ? -1 : text.indexOf("/>", bodyEnd + BODY_CLOSE.length);
  if (close === -1) return null;
  return { end: close + 2, body: { start: bodyStart, innerStart: bodyStart + BODY_OPEN.length, innerEnd: bodyEnd, end: bodyEnd + BODY_CLOSE.length } };
}

function describeEmbed(name, attributes, inner) {
  const figure = attribute(attributes, "figure");
  const lines = [];
  // The label goes first so the model reads "this is a bad example" before the example itself.
  const label = EXAMPLE_LABELS[attribute(attributes, "figurePrefix")];
  if (label) lines.push(label);
  if (name === "emailEmbed" && attribute(attributes, "subject")) lines.push(`Email subject: ${attribute(attributes, "subject")}`);
  if (name === "youtubeEmbed" && attribute(attributes, "description")) lines.push(`Video: ${attribute(attributes, "description").replace(/^video:\s*/i, "")}`);
  if (inner) lines.push(inner);
  if (figure) lines.push(name === "imageEmbed" ? `Picture: ${figure}` : `Caption: ${figure}`);
  // No blank lines or marks inside, so the whole example stays one paragraph and is chunked as a unit.
  return lines
    .join("\n")
    .replaceAll(EMBED_MARK, "")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

function replaceEmbeds(text) {
  let result = "";
  let position = 0;
  for (const match of text.matchAll(/<(\w+Embed)\b/g)) {
    if (match.index < position) continue;
    const found = findEmbedEnd(text, match.index);
    if (!found) continue;
    const { end, body } = found;
    const attributes = body ? text.slice(match.index, body.start) + text.slice(body.end, end) : text.slice(match.index, end);
    const inner = body ? replaceEmbeds(text.slice(body.innerStart, body.innerEnd)).trim() : "";
    result += `${text.slice(position, match.index)}\n\n${EMBED_MARK}${describeEmbed(match[1], attributes, inner)}\n\n`;
    position = end;
  }
  return result + text.slice(position);
}

const CODE_FENCE = /(```[\s\S]*?```)/;

export function toPlainText(body) {
  return (
    replaceEmbeds(body)
      .replace(/<endIntro\s*\/>/g, "")
      .split(CODE_FENCE)
      // Code samples are kept as written: stripping links and tags there would damage them.
      .map((part, index) =>
        index % 2 === 1
          ? part
          : part
              .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
              .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
              .replace(/<\/?(?:mark|div|p|span|br|a|img)\b[^>]*>/g, " ")
      )
      .join("")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// Joins each Markdown caption to the paragraph it describes, and labels an unlabelled embed from its caption.
function attachCaptions(paragraphs) {
  const merged = [];
  for (const paragraph of paragraphs) {
    const caption = paragraph.match(CAPTION_PATTERN);
    const previous = merged[merged.length - 1];
    if (!caption || previous === undefined || /^#{1,6}\s/.test(previous)) {
      merged.push(paragraph);
      continue;
    }
    const isUnlabelledEmbed = previous.startsWith(EMBED_MARK) && !LABEL_PATTERN.test(previous.slice(1).split("\n")[0]);
    const label = EXAMPLE_LABELS[caption[1].toLowerCase()];
    merged[merged.length - 1] = isUnlabelledEmbed ? `${label}\n${previous.slice(1)}\n${paragraph}` : `${previous}\n${paragraph}`;
  }
  return merged.map((paragraph) => paragraph.replaceAll(EMBED_MARK, ""));
}

// An example too long for one chunk repeats its label on every piece.
function splitLongParagraph(paragraph) {
  if (paragraph.length <= MAX_CHUNK_CHARS) return [paragraph];
  const firstLine = paragraph.split("\n")[0];
  const label = LABEL_PATTERN.test(firstLine) ? firstLine : "";
  const body = label ? paragraph.slice(label.length + 1) : paragraph;
  const size = MAX_CHUNK_CHARS - (label ? label.length + 1 : 0);
  const pieces = [];
  for (let start = 0; start < body.length; start += size) pieces.push((label ? `${label}\n` : "") + body.slice(start, start + size));
  return pieces;
}

// One chunk per heading section, split further at paragraph breaks when a section is long.
export function chunkRule(text) {
  const chunks = [];
  let heading = "";
  let buffer = "";
  const flush = () => {
    if (buffer.trim()) chunks.push({ heading, content: buffer.trim() });
    buffer = "";
  };

  let insideCodeFence = false;
  for (const paragraph of attachCaptions(text.split(/\n{2,}/))) {
    // A "# comment" line inside a code sample is not a heading.
    const headingMatch = insideCodeFence ? null : paragraph.match(/^#{1,6}\s+(.+)$/);
    if ((paragraph.match(/```/g)?.length ?? 0) % 2 === 1) insideCodeFence = !insideCodeFence;
    if (headingMatch) {
      flush();
      heading = headingMatch[1].replace(/[*_`]/g, "").trim();
      continue;
    }
    for (const piece of splitLongParagraph(paragraph)) {
      if (buffer && buffer.length + piece.length + 2 > MAX_CHUNK_CHARS) flush();
      buffer += (buffer ? "\n\n" : "") + piece;
    }
  }
  flush();
  return chunks;
}
