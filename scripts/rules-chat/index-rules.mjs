// Builds the Rules Chat vector index: reads every rule from the content repo, splits it into
// chunks, embeds them and stores them in SQL Server. Safe to re-run: unchanged rules are skipped.
//
//   pnpm rules-chat:index                index new and changed rules
//   pnpm rules-chat:index --reset        empty the index and index everything again
//   pnpm rules-chat:index --sample <n>   index only the first n rules, for a quick local setup
//   pnpm rules-chat:index --show <uri>   print the chunks for one rule without indexing

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DefaultAzureCredential } from "@azure/identity";
import matter from "gray-matter";
import sql from "mssql";
import { connect, loadEnv, requireEnv, siteRoot } from "./sql.mjs";

loadEnv();

const MAX_CHUNK_CHARS = 1800;
const EMBEDDING_BATCH_SIZE = 16;
// Must match RuleChunk.EmbeddingDimensions in src/RulesChat/RulesChat.Database.
const EMBEDDING_DIMENSIONS = 1024;
// Bump when the cleaning or chunking rules change, so every rule is re-indexed on the next run.
const CHUNKING_VERSION = "4";

const config = {
  rulesDir: resolve(siteRoot, "scripts", requireEnv("LOCAL_CONTENT_RELATIVE_PATH"), "public/uploads/rules"),
  aiBaseUrl: requireEnv("RULES_CHAT_AI_BASE_URL").replace(/\/+$/, ""),
  // Ollama takes any key. Without one, Microsoft Foundry is called with a Microsoft Entra token.
  aiApiKey: process.env.RULES_CHAT_AI_API_KEY,
  embeddingModel: requireEnv("RULES_CHAT_EMBEDDING_MODEL"),
  // Unset for a model that returns 1024 dimensions natively (bge-m3). A larger model (text-embedding-3-large) is asked
  // for this many instead.
  requestDimensions: process.env.RULES_CHAT_EMBEDDING_DIMENSIONS ? Number(process.env.RULES_CHAT_EMBEDDING_DIMENSIONS) : undefined,
};

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

function toPlainText(body) {
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
function chunkRule(text) {
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

function readRule(uriFolder) {
  const file = join(config.rulesDir, uriFolder, "rule.mdx");
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  if (data.isArchived === true || data.archivedreason || !data.title || !data.uri) return null;
  const description = data.seoDescription ? `${data.seoDescription}\n\n` : "";
  return {
    uri: String(data.uri),
    title: String(data.title),
    hash: createHash("sha256").update(CHUNKING_VERSION).update(config.embeddingModel).update(raw).digest("hex"),
    chunks: chunkRule(description + toPlainText(content)),
  };
}

const credential = config.aiApiKey ? null : new DefaultAzureCredential({ managedIdentityClientId: process.env.RULES_CHAT_IDENTITY_CLIENT_ID });
let cachedToken = null;

async function authorization() {
  if (config.aiApiKey) return `Bearer ${config.aiApiKey}`;
  // Some credentials, such as the Azure CLI's, don't cache, and a full index makes thousands of calls.
  if (!cachedToken || cachedToken.expiresOnTimestamp - Date.now() < 5 * 60 * 1000) {
    cachedToken = await credential.getToken("https://cognitiveservices.azure.com/.default");
  }
  return `Bearer ${cachedToken.token}`;
}

async function embed(texts) {
  const response = await fetch(`${config.aiBaseUrl}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: await authorization() },
    body: JSON.stringify({
      model: config.embeddingModel,
      input: texts,
      ...(config.requestDimensions ? { dimensions: config.requestDimensions } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Embedding request failed (${response.status}): ${await response.text()}`);
  const { data } = await response.json();
  return data.map((item) => item.embedding);
}

async function saveRule(pool, rule, embeddings) {
  const rows = rule.chunks.map((chunk, index) => ({ index, heading: chunk.heading, content: chunk.content, embedding: JSON.stringify(embeddings[index]) }));
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input("uri", sql.NVarChar(400), rule.uri)
      .input("title", sql.NVarChar(500), rule.title)
      .input("hash", sql.Char(64), rule.hash)
      .input("rows", sql.NVarChar(sql.MAX), JSON.stringify(rows))
      .query(`
        DELETE FROM dbo.RuleChunks WHERE RuleUri = @uri;
        DELETE FROM dbo.IndexedRules WHERE RuleUri = @uri;
        INSERT INTO dbo.IndexedRules (RuleUri, RuleTitle, ContentHash) VALUES (@uri, @title, @hash);
        INSERT INTO dbo.RuleChunks (RuleUri, ChunkIndex, Heading, Content, Embedding)
        SELECT @uri, r.[index], r.heading, r.content, CAST(r.embedding AS VECTOR(${EMBEDDING_DIMENSIONS}))
        FROM OPENJSON(@rows) WITH ([index] INT, heading NVARCHAR(500), content NVARCHAR(MAX), embedding NVARCHAR(MAX)) r;`);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : (process.argv[index + 1] ?? "");
}

async function main() {
  const reset = process.argv.includes("--reset");
  if (!existsSync(config.rulesDir)) throw new Error(`Rules folder not found: ${config.rulesDir}`);

  const showUri = readArgument("--show");
  if (showUri !== undefined) {
    const rule = readRule(showUri);
    if (!rule) throw new Error("Pass the uri of an active rule after --show");
    for (const [index, chunk] of rule.chunks.entries())
      console.log(`\n----- chunk ${index + 1}/${rule.chunks.length}${chunk.heading ? ` (${chunk.heading})` : ""} -----\n${chunk.content}`);
    return;
  }

  const sampleArgument = readArgument("--sample");
  const sample = sampleArgument === undefined ? undefined : Number(sampleArgument);
  if (sample !== undefined && !(Number.isInteger(sample) && sample > 0)) throw new Error("Pass a whole number of rules after --sample");

  const allRules = readdirSync(config.rulesDir)
    .sort()
    .map(readRule)
    .filter((rule) => rule && rule.chunks.length > 0);
  const rules = sample ? allRules.slice(0, sample) : allRules;
  console.log(`Read ${allRules.length} active rules from ${config.rulesDir}${sample ? `, indexing the first ${rules.length}` : ""}`);

  const [probe] = await embed(["dimension probe"]);
  if (probe.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `${config.embeddingModel} returned ${probe.length} dimensions, but the index stores ${EMBEDDING_DIMENSIONS}. ` +
        `For a larger model, set RULES_CHAT_EMBEDDING_DIMENSIONS=${EMBEDDING_DIMENSIONS}.`
    );
  }

  const pool = await connect();
  try {
    if (reset) await pool.request().batch("DELETE FROM dbo.RuleChunks; DELETE FROM dbo.IndexedRules;");

    const indexed = new Map(
      (await pool.request().query("SELECT RuleUri, ContentHash FROM dbo.IndexedRules")).recordset.map((row) => [row.RuleUri, row.ContentHash])
    );
    // A sample leaves the other rules out on purpose, so only a full run removes rules that no longer exist.
    const currentUris = new Set(allRules.map((rule) => rule.uri));
    const removed = sample ? [] : [...indexed.keys()].filter((uri) => !currentUris.has(uri));
    for (const uri of removed) {
      await pool
        .request()
        .input("uri", sql.NVarChar(400), uri)
        .query("DELETE FROM dbo.RuleChunks WHERE RuleUri = @uri; DELETE FROM dbo.IndexedRules WHERE RuleUri = @uri;");
    }

    const pending = rules.filter((rule) => indexed.get(rule.uri) !== rule.hash);
    console.log(`${pending.length} to index, ${rules.length - pending.length} unchanged, ${removed.length} removed (${config.embeddingModel})`);

    const started = Date.now();
    let chunkCount = 0;
    for (const [position, rule] of pending.entries()) {
      const embeddings = [];
      for (let start = 0; start < rule.chunks.length; start += EMBEDDING_BATCH_SIZE) {
        const batch = rule.chunks.slice(start, start + EMBEDDING_BATCH_SIZE);
        // The title and heading go into the embedded text so a chunk still says what rule it belongs to.
        embeddings.push(...(await embed(batch.map((chunk) => [rule.title, chunk.heading, chunk.content].filter(Boolean).join("\n\n")))));
      }
      await saveRule(pool, rule, embeddings);
      chunkCount += rule.chunks.length;
      if ((position + 1) % 100 === 0 || position + 1 === pending.length) {
        console.log(`  ${position + 1}/${pending.length} rules, ${chunkCount} chunks, ${Math.round((Date.now() - started) / 1000)}s`);
      }
    }

    const totals = (await pool.request().query("SELECT (SELECT COUNT(*) FROM dbo.IndexedRules) AS Rules, (SELECT COUNT(*) FROM dbo.RuleChunks) AS Chunks"))
      .recordset[0];
    console.log(`Index now holds ${totals.Rules} rules in ${totals.Chunks} chunks`);
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
