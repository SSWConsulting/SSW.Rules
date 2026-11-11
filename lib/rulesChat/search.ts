import sql from "mssql";
import { aiHeaders } from "./ai";
import { getRulesChatConfig } from "./config";
import { getPool } from "./db";

export type FoundRule = { uri: string; title: string; excerpts: string[] };

const CANDIDATE_CHUNKS = 24;
const MAX_RULES = 8;
const MAX_EXCERPTS_PER_RULE = 2;
const EXCERPTS_PER_REFERENCED_RULE = 4;

async function embed(text: string, signal: AbortSignal): Promise<number[]> {
  const { aiBaseUrl, embeddingModel, embeddingDimensions } = getRulesChatConfig();
  const response = await fetch(`${aiBaseUrl}/embeddings`, {
    method: "POST",
    signal,
    headers: await aiHeaders(),
    body: JSON.stringify({ model: embeddingModel, input: [text], ...(embeddingDimensions ? { dimensions: embeddingDimensions } : {}) }),
  });
  if (!response.ok) throw new Error(`Embedding request failed (${response.status}): ${await response.text()}`);
  const { data } = await response.json();
  const embedding = data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) throw new Error("Embedding response held no vector");
  return embedding;
}

type ChunkRow = { RuleUri: string; RuleTitle: string; Heading: string; Content: string };

async function closestChunks(embedding: number[], top: number, ruleUri?: string): Promise<ChunkRow[]> {
  const connection = await getPool();
  const result = await connection
    .request()
    .input("query", sql.NVarChar(sql.MAX), JSON.stringify(embedding))
    .input("top", sql.Int, top)
    .input("uri", sql.NVarChar(400), ruleUri ?? null)
    .query<ChunkRow>(`
      SELECT TOP (@top) c.RuleUri, r.RuleTitle, c.Heading, c.Content
      FROM dbo.RuleChunks c
      JOIN dbo.IndexedRules r ON r.RuleUri = c.RuleUri
      WHERE @uri IS NULL OR c.RuleUri = @uri
      ORDER BY VECTOR_DISTANCE('cosine', c.Embedding, CAST(@query AS VECTOR(${embedding.length})))`);
  return result.recordset;
}

function addChunks(byRule: Map<string, FoundRule>, rows: ChunkRow[], maxExcerpts: number, maxRules: number) {
  for (const row of rows) {
    let rule = byRule.get(row.RuleUri);
    if (!rule) {
      if (byRule.size >= maxRules) continue;
      rule = { uri: row.RuleUri, title: row.RuleTitle, excerpts: [] };
      byRule.set(row.RuleUri, rule);
    }
    if (rule.excerpts.length < maxExcerpts) rule.excerpts.push(row.Heading ? `${row.Heading}\n${row.Content}` : row.Content);
  }
}

// The rules the user pointed at come first, with more of their text; then the closest matches for the question.
export async function searchRules(query: string, referencedUris: string[], signal: AbortSignal): Promise<FoundRule[]> {
  const embedding = await embed(query, signal);
  const byRule = new Map<string, FoundRule>();
  for (const uri of referencedUris)
    addChunks(byRule, await closestChunks(embedding, EXCERPTS_PER_REFERENCED_RULE, uri), EXCERPTS_PER_REFERENCED_RULE, Number.POSITIVE_INFINITY);
  addChunks(byRule, await closestChunks(embedding, CANDIDATE_CHUNKS), MAX_EXCERPTS_PER_RULE, referencedUris.length + MAX_RULES);
  return [...byRule.values()];
}
