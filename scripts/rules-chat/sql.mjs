// Connection and schema helpers shared by the Rules Chat scripts.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";

export const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const schemaDir = join(siteRoot, "db/rules-chat");

export function loadEnv() {
  for (const envFile of [".env.local", ".env"]) {
    const path = join(siteRoot, envFile);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env.local (see .env.example).`);
  return value;
}

// A password means a local SQL Server in Docker. Without one, Azure SQL is reached with Microsoft Entra: the managed
// identity whose client ID is in RULES_CHAT_IDENTITY_CLIENT_ID on Azure, or the signed-in Azure CLI in the pipeline.
export function sqlConfig(database = requireEnv("RULES_CHAT_SQL_DATABASE")) {
  const server = requireEnv("RULES_CHAT_SQL_SERVER");
  const port = Number(process.env.RULES_CHAT_SQL_PORT || 1433);
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

export async function connect() {
  return new sql.ConnectionPool(sqlConfig()).connect();
}

// Azure SQL databases are created by the infrastructure. A local SQL Server starts empty, so create it there.
export async function ensureLocalDatabase() {
  if (!process.env.RULES_CHAT_SQL_PASSWORD) return;
  const database = requireEnv("RULES_CHAT_SQL_DATABASE");
  const master = await new sql.ConnectionPool(sqlConfig("master")).connect();
  try {
    await master
      .request()
      .input("name", sql.NVarChar(128), database)
      .query("IF DB_ID(@name) IS NULL BEGIN DECLARE @create NVARCHAR(300) = N'CREATE DATABASE ' + QUOTENAME(@name); EXEC (@create); END");
  } finally {
    await master.close();
  }
}

// Runs every file in db/rules-chat in name order. Each file is idempotent, so this is safe to run on every deploy.
export async function applySchema(pool) {
  const files = readdirSync(schemaDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await pool.request().batch(readFileSync(join(schemaDir, file), "utf8"));
    console.log(`Applied ${file}`);
  }
}

// Drops the index tables, children first, so applySchema recreates them empty.
export async function dropIndexTables(pool) {
  await pool.request().batch("DROP TABLE IF EXISTS dbo.RuleChunks; DROP TABLE IF EXISTS dbo.IndexedRules;");
}
