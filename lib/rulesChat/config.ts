import type sql from "mssql";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Read lazily so a build without the chat settings still succeeds.
export function getRulesChatConfig() {
  return {
    aiBaseUrl: requireEnv("RULES_CHAT_AI_BASE_URL").replace(/\/+$/, ""),
    // Ollama takes any key. Without one, Microsoft Foundry is called with a Microsoft Entra token (see ai.ts).
    aiApiKey: process.env.RULES_CHAT_AI_API_KEY || undefined,
    embeddingModel: requireEnv("RULES_CHAT_EMBEDDING_MODEL"),
    // Unset for a model that returns 1024 dimensions natively (bge-m3); text-embedding-3-large is asked for 1024.
    embeddingDimensions: process.env.RULES_CHAT_EMBEDDING_DIMENSIONS ? Number(process.env.RULES_CHAT_EMBEDDING_DIMENSIONS) : undefined,
    chatModel: requireEnv("RULES_CHAT_CHAT_MODEL"),
    // Optional: local reasoning models answer much faster with "none"; leave unset for models that reject it.
    reasoningEffort: process.env.RULES_CHAT_REASONING_EFFORT || undefined,
    sql: getSqlConfig(),
  };
}

// Mirrors scripts/rules-chat/sql.mjs. A password means the local SQL Server that Aspire runs in Docker. Without one,
// Azure SQL is reached with Microsoft Entra as the managed identity whose client ID is RULES_CHAT_IDENTITY_CLIENT_ID.
function getSqlConfig(): sql.config {
  const server = requireEnv("RULES_CHAT_SQL_SERVER");
  const port = Number(process.env.RULES_CHAT_SQL_PORT || 1433);
  const database = requireEnv("RULES_CHAT_SQL_DATABASE");
  const password = process.env.RULES_CHAT_SQL_PASSWORD;
  if (password) {
    return {
      server,
      port,
      database,
      user: requireEnv("RULES_CHAT_SQL_USER"),
      password,
      // Only a local SQL Server with a self-signed certificate should opt in to trusting it.
      options: { encrypt: true, trustServerCertificate: process.env.RULES_CHAT_SQL_TRUST_CERTIFICATE === "true" },
    };
  }
  return {
    server,
    port,
    database,
    authentication: { type: "azure-active-directory-default", options: { clientId: process.env.RULES_CHAT_IDENTITY_CLIENT_ID || undefined } },
    options: { encrypt: true },
  };
}

function readAmount(name: string, fallback?: number): number {
  const raw = process.env[name];
  if (!raw) {
    if (fallback === undefined) throw new Error(`${name} is not set`);
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a number of 0 or more, not "${raw}"`);
  return value;
}

export type RulesChatLimits = {
  // 0 keeps The Rulekeeper to SSW staff.
  memberDailyLimit: number;
  monthlyBudgetUsd: number;
  inputPricePerMillionTokensUsd: number;
  outputPricePerMillionTokensUsd: number;
};

export function getRulesChatLimits(): RulesChatLimits {
  return {
    memberDailyLimit: readAmount("RULES_CHAT_MEMBER_DAILY_LIMIT", 0),
    monthlyBudgetUsd: readAmount("RULES_CHAT_MONTHLY_BUDGET_USD"),
    inputPricePerMillionTokensUsd: readAmount("RULES_CHAT_INPUT_PRICE_PER_MILLION_TOKENS_USD"),
    outputPricePerMillionTokensUsd: readAmount("RULES_CHAT_OUTPUT_PRICE_PER_MILLION_TOKENS_USD"),
  };
}
