// Sets up The Rulekeeper on this machine: settings, SQL Server in Docker, the embedding model in Ollama, the tables,
// and an index of a sample of rules. Safe to run again; each step skips what's already done.
//
//   pnpm rules-chat:setup          index a sample of 200 rules (a few minutes)
//   pnpm rules-chat:setup --all    index every rule (much longer)

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sql from "mssql";
import { loadEnv, requireEnv, siteRoot, sqlConfig } from "./sql.mjs";

const SAMPLE_SIZE = 200;
const SQL_START_TIMEOUT_MS = 180_000;
const envLocalPath = join(siteRoot, ".env.local");
const composeFile = join(siteRoot, "scripts/rules-chat/docker-compose.yml");

class SetupError extends Error {}

function step(message) {
  console.log(`\n==> ${message}`);
}

// SQL Server rejects passwords without upper case, lower case, digits and symbols.
function generateSqlPassword() {
  return `Rk-${randomBytes(18).toString("base64url")}9a!`;
}

function localDefaults() {
  return {
    RULES_CHAT_SQL_SERVER: "localhost",
    RULES_CHAT_SQL_PORT: "14333",
    RULES_CHAT_SQL_DATABASE: "RulesChat",
    RULES_CHAT_SQL_USER: "sa",
    RULES_CHAT_SQL_PASSWORD: generateSqlPassword(),
    RULES_CHAT_SQL_TRUST_CERTIFICATE: "true",
    RULES_CHAT_AI_BASE_URL: "http://localhost:11434/v1",
    RULES_CHAT_AI_API_KEY: "ollama",
    RULES_CHAT_EMBEDDING_MODEL: "bge-m3",
  };
}

function addMissingSettings() {
  step("Checking .env.local");
  const existing = existsSync(envLocalPath) ? readFileSync(envLocalPath, "utf8") : "";
  const defined = new Set([...existing.matchAll(/^\s*([A-Z0-9_]+)\s*=/gm)].map((match) => match[1]));
  const missing = Object.entries(localDefaults()).filter(([name]) => !defined.has(name));
  if (missing.length === 0) {
    console.log("All Rules Chat settings are there");
    return;
  }
  const block = missing.map(([name, value]) => `${name}=${value}`).join("\n");
  appendFileSync(envLocalPath, `${existing && !existing.endsWith("\n") ? "\n" : ""}\n# The Rulekeeper, added by pnpm rules-chat:setup\n${block}\n`);
  console.log(`Added ${missing.map(([name]) => name).join(", ")}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error?.code === "ENOENT") throw new SetupError(`${command} isn't installed or isn't on your PATH.`);
  return result.status === 0;
}

function checkContent() {
  step("Checking the rules content");
  const rulesDir = resolve(siteRoot, "scripts", requireEnv("LOCAL_CONTENT_RELATIVE_PATH"), "public/uploads/rules");
  if (!existsSync(rulesDir)) {
    throw new SetupError(`No rules at ${rulesDir}. Clone SSWConsulting/SSW.Rules.Content next to this repo, or fix LOCAL_CONTENT_RELATIVE_PATH.`);
  }
  console.log(rulesDir);
}

async function prepareOllama() {
  const baseUrl = requireEnv("RULES_CHAT_AI_BASE_URL").replace(/\/v1\/?$/, "");
  const model = requireEnv("RULES_CHAT_EMBEDDING_MODEL");
  step(`Checking Ollama at ${baseUrl}`);
  let tags;
  try {
    tags = await (await fetch(`${baseUrl}/api/tags`)).json();
  } catch {
    throw new SetupError("Ollama isn't running. Install it from https://ollama.com, start it, then run this again.");
  }
  if (tags.models?.some((installed) => installed.name === model || installed.name === `${model}:latest`)) {
    console.log(`${model} is installed`);
    return;
  }
  console.log(`Pulling ${model}. This downloads about 1 GB once.`);
  const response = await fetch(`${baseUrl}/api/pull`, { method: "POST", body: JSON.stringify({ model, stream: false }) });
  if (!response.ok) throw new SetupError(`Ollama couldn't pull ${model}: ${await response.text()}`);
  console.log(`${model} is installed`);
}

async function startSqlServer() {
  step("Starting SQL Server in Docker");
  if (!run("docker", ["info"], { stdio: "ignore" })) throw new SetupError("Docker isn't running. Start Docker Desktop, then run this again.");
  if (!run("docker", ["compose", "--env-file", envLocalPath, "-f", composeFile, "up", "-d"])) {
    throw new SetupError("docker compose couldn't start SQL Server. The output above says why.");
  }

  // On Apple Silicon the image runs under emulation and can take a minute or two to accept connections.
  console.log("Waiting for SQL Server to accept connections");
  const deadline = Date.now() + SQL_START_TIMEOUT_MS;
  for (;;) {
    try {
      const pool = await new sql.ConnectionPool({ ...sqlConfig("master"), connectionTimeout: 5000 }).connect();
      await pool.close();
      console.log("SQL Server is ready");
      return;
    } catch (error) {
      if (error.code === "ELOGIN" && /Login failed/.test(error.message)) {
        throw new SetupError(
          "SQL Server rejected the password. It keeps the password it first started with: either put that one in RULES_CHAT_SQL_PASSWORD, or remove the container and its volume (docker compose -f scripts/rules-chat/docker-compose.yml down -v) and run this again."
        );
      }
      if (Date.now() > deadline) throw new SetupError(`SQL Server didn't accept connections within ${SQL_START_TIMEOUT_MS / 1000}s: ${error.message}`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 3000));
    }
  }
}

function indexRules(all) {
  step(all ? "Indexing every rule" : `Indexing a sample of ${SAMPLE_SIZE} rules`);
  const args = [join(siteRoot, "scripts/rules-chat/index-rules.mjs"), ...(all ? [] : ["--sample", String(SAMPLE_SIZE)])];
  if (!run(process.execPath, args)) throw new SetupError("Indexing failed. The output above says why.");
}

async function main() {
  const all = process.argv.includes("--all");
  addMissingSettings();
  loadEnv();
  if (!process.env.RULES_CHAT_SQL_PASSWORD || !process.env.RULES_CHAT_AI_API_KEY) {
    throw new SetupError(
      "This sets up a local copy with Docker and Ollama. .env.local points The Rulekeeper at Azure instead (no SQL password or AI API key)."
    );
  }
  checkContent();
  await prepareOllama();
  await startSqlServer();
  indexRules(all);
  console.log("\nThe Rulekeeper's database is ready. See docs/rulekeeper/local-development.md for what to do next.");
}

main().catch((error) => {
  console.error(error instanceof SetupError ? `\n${error.message}` : error);
  process.exitCode = 1;
});
