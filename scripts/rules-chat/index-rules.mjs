// Builds the Rules Chat vector index: reads every rule from the content repo, splits it into
// chunks, embeds them and stores them in SQL Server. Safe to re-run: unchanged rules are skipped.
//
//   pnpm rules-chat:index                index new and changed rules
//   pnpm rules-chat:index --reembed      embed every rule again, replacing each one as it goes
//   pnpm rules-chat:index --allow-removals   let a full run remove more than a fifth of the index
//   pnpm rules-chat:index --sample <n>   index only the first n rules, for a quick local setup
//   pnpm rules-chat:index --show <uri>   print the chunks for one rule without indexing

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DefaultAzureCredential } from "@azure/identity";
import matter from "gray-matter";
import sql from "mssql";
import { chunkRule, toPlainText } from "./chunking.mjs";
import { connect, loadEnv, requireEnv, siteRoot } from "./sql.mjs";

loadEnv();

const EMBEDDING_BATCH_SIZE = 16;
const MAX_EMBEDDING_ATTEMPTS = 5;
// A full run that would remove more than this share of the index more likely read the rules wrongly than lost them.
const MAX_REMOVED_SHARE = 0.2;
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

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

// Rate limits (429) and server errors are retried, waiting as long as Retry-After asks or backing off otherwise.
async function embed(texts) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${config.aiBaseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: await authorization() },
      body: JSON.stringify({
        model: config.embeddingModel,
        input: texts,
        ...(config.requestDimensions ? { dimensions: config.requestDimensions } : {}),
      }),
    });
    if (response.ok) {
      const { data } = await response.json();
      return data.map((item) => item.embedding);
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_EMBEDDING_ATTEMPTS) {
      throw new Error(`Embedding request failed (${response.status}) after ${attempt} attempts: ${await response.text()}`);
    }
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 2 ** attempt * 1000;
    console.warn(`Embedding request returned ${response.status}; retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${MAX_EMBEDDING_ATTEMPTS})`);
    await delay(waitMs);
  }
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
  const reembed = process.argv.includes("--reembed");
  const allowRemovals = process.argv.includes("--allow-removals");
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
  if (allRules.length === 0) throw new Error(`No active rules found in ${config.rulesDir}. Check the content checkout and the rule front matter.`);
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
    const indexed = new Map(
      (await pool.request().query("SELECT RuleUri, ContentHash FROM dbo.IndexedRules")).recordset.map((row) => [row.RuleUri, row.ContentHash])
    );
    // A sample leaves the other rules out on purpose, so only a full run removes rules that no longer exist.
    const currentUris = new Set(allRules.map((rule) => rule.uri));
    const removed = sample ? [] : [...indexed.keys()].filter((uri) => !currentUris.has(uri));
    if (!allowRemovals && removed.length > indexed.size * MAX_REMOVED_SHARE) {
      throw new Error(`This run would remove ${removed.length} of the ${indexed.size} indexed rules. If that's intended, run again with --allow-removals.`);
    }
    for (const uri of removed) {
      await pool
        .request()
        .input("uri", sql.NVarChar(400), uri)
        .query("DELETE FROM dbo.RuleChunks WHERE RuleUri = @uri; DELETE FROM dbo.IndexedRules WHERE RuleUri = @uri;");
    }

    // A re-embed replaces each rule in its own transaction, so the chat searches a full index throughout.
    const pending = reembed ? rules : rules.filter((rule) => indexed.get(rule.uri) !== rule.hash);
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
